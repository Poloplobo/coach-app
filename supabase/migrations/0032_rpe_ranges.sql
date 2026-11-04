-- RPE visé en fourchette d'entiers (décision du 04/11/2026) : le staff écrit « 5,6 » pour « 5 ou 6 », pas 5,6. Les
-- valeurs déjà saisies deviennent l'entier du dessous et celui du dessus (3,4 → 3-4 ; 4 → 4-4 ; 6,5 → 6-7).
-- Le seuil de charge d'une séance en découle (haut de la fourchette × durée prévue) : plus de seuil fixe par activité.
alter table public.week_type_rpe add column rpe_min smallint, add column rpe_max smallint;
update public.week_type_rpe set rpe_min = floor(target_rpe), rpe_max = ceil(target_rpe);
alter table public.week_type_rpe
  alter column rpe_min set not null, alter column rpe_max set not null,
  add constraint week_type_rpe_range check (rpe_min between 0 and 10 and rpe_max between rpe_min and 10),
  drop column target_rpe;

-- Séance du planning : planned_rpe = bas de la fourchette, planned_rpe_max = haut
alter table public.planned_sessions add column planned_rpe_max smallint;
update public.planned_sessions set planned_rpe_max = ceil(planned_rpe), planned_rpe = floor(planned_rpe) where planned_rpe is not null;
alter table public.planned_sessions add constraint planned_rpe_range
  check ((planned_rpe is null and planned_rpe_max is null) or (planned_rpe = trunc(planned_rpe) and planned_rpe_max between planned_rpe and 10));

-- Dupliquer une semaine copie aussi le haut de la fourchette (même fonction que 0021, une colonne de plus)
create or replace function public.duplicate_week(p_group uuid, p_from date, p_to date, p_loads jsonb default '{}', p_group_plan boolean default true)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_shift int := p_to - p_from;
  v_off boolean;
  v_src record;
  v_new uuid;
  v_group int := 0;
  v_individual int := 0;
  v_skipped int := 0;
begin
  -- La RLS bloque déjà toute écriture d'un joueur ; refus explicite plutôt qu'une copie vide silencieuse
  if not public.is_staff() then raise exception 'réservé au staff' using errcode = '42501'; end if;
  if v_shift <= 0 or v_shift % 7 <> 0 then raise exception 'la semaine cible doit suivre la semaine source' using errcode = 'P0001'; end if;
  select is_off into v_off from public.season_weeks where group_id = p_group and start_date = p_to;
  if v_off is null then raise exception 'semaine cible absente du calendrier' using errcode = 'P0002'; end if;
  if exists (select 1 from jsonb_each_text(p_loads) l where case when l.value ~ '^\d{1,4}(\.\d+)?$' then l.value::numeric > 1000 else true end) then
    raise exception 'charge invalide' using errcode = 'P0001';
  end if;

  for v_src in
    select * from public.planned_sessions
    where session_date between p_from and p_from + 6
      and ((p_group_plan and group_id = p_group)
           or player_id in (select gm.player_id from public.group_members gm where gm.group_id = p_group))
    order by session_date, created_at
  loop
    -- Semaine OFF : pas de collectif ; jours déjà passés : l'historique ne se réécrit pas
    if (v_src.group_id is not null and v_off) or v_src.session_date + v_shift < public.paris_today() then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    -- Une séance déjà programmée ce jour-là (même activité, même titre) est conservée telle quelle
    insert into public.planned_sessions
      (session_date, title, focus, planned_duration_min, planned_rpe, planned_rpe_max, group_id, player_id, activity_type_id, created_by)
    values (v_src.session_date + v_shift, v_src.title, v_src.focus, v_src.planned_duration_min, v_src.planned_rpe, v_src.planned_rpe_max,
            v_src.group_id, v_src.player_id, v_src.activity_type_id, auth.uid())
    on conflict on constraint planned_sessions_unique do nothing
    returning id into v_new;
    if v_new is null then v_skipped := v_skipped + 1; continue; end if;

    insert into public.planned_exercises
      (planned_session_id, exercise_id, position, block_label, sets, reps, target_velocity,
       load_value, load_unit, tempo, rest, instructions)
    select v_new, pe.exercise_id, pe.position, pe.block_label, pe.sets, pe.reps, pe.target_velocity,
           coalesce((p_loads ->> pe.id::text)::numeric, pe.load_value), pe.load_unit, pe.tempo, pe.rest, pe.instructions
    from public.planned_exercises pe where pe.planned_session_id = v_src.id;

    if v_src.group_id is not null then v_group := v_group + 1; else v_individual := v_individual + 1; end if;
  end loop;

  return jsonb_build_object('group', v_group, 'individual', v_individual, 'skipped', v_skipped);
end $$;

alter table public.activity_types drop column max_srpe;

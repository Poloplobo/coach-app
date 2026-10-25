-- Étape 8 : dupliquer une semaine (planning du groupe + séances individuelles de ses joueurs, avec leurs exercices)
-- sur une semaine suivante du calendrier (l'écran propose la semaine d'après).
-- Les nouvelles charges sont calculées dans l'app (règle de progression, testée) et passées dans p_loads :
-- { "<id de l'exercice source>": <nouvelle charge> } ; un exercice absent garde sa charge.
-- security invoker : la RLS s'applique, seul le staff peut écrire dans planned_sessions / planned_exercises.
create function public.duplicate_week(p_group uuid, p_from date, p_to date, p_loads jsonb default '{}')
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
      and (group_id = p_group
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
      (session_date, title, focus, planned_duration_min, planned_rpe, group_id, player_id, activity_type_id, created_by)
    values (v_src.session_date + v_shift, v_src.title, v_src.focus, v_src.planned_duration_min, v_src.planned_rpe,
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

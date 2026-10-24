-- Étape 6 : programmation dans l'app

-- Semaine OFF : pas d'entraînement collectif (jusqu'ici déduit du libellé « (OFF) » des classeurs)
alter table public.season_weeks add column is_off boolean not null default false;
update public.season_weeks set is_off = true where label ilike '%(OFF)%';

-- Enregistre en une fois les exercices d'une séance de musculation (ajouts, modifications, ordre, suppressions).
-- security invoker : la RLS s'applique, seul le staff peut écrire dans planned_exercises.
create function public.save_muscu_exercises(p_session uuid, p_exercises jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_date date;
  v_keep uuid[] := array(select (e->>'id')::uuid from jsonb_array_elements(p_exercises) e where e->>'id' is not null);
begin
  select session_date into v_date from public.planned_sessions where id = p_session;
  if v_date is null then raise exception 'séance introuvable' using errcode = 'P0002'; end if;
  -- L'historique ne se réécrit pas : le joueur a répondu sur la prescription de ce jour-là
  if v_date < public.paris_today() then raise exception 'séance passée : non modifiable' using errcode = 'P0001'; end if;
  -- Un identifiant d'exercice d'une autre séance ne doit jamais être modifié par ce biais
  if exists (select 1 from unnest(v_keep) k where not exists (
    select 1 from public.planned_exercises pe where pe.id = k and pe.planned_session_id = p_session
  )) then raise exception 'exercice d''une autre séance' using errcode = 'P0001'; end if;
  -- Supprimer un exercice effacerait le retour du joueur (on delete cascade)
  if exists (
    select 1 from public.planned_exercises pe join public.exercise_feedback f on f.planned_exercise_id = pe.id
    where pe.planned_session_id = p_session and not (pe.id = any (v_keep))
  ) then raise exception 'exercice déjà renseigné par le joueur : non supprimable' using errcode = 'P0001'; end if;

  delete from public.planned_exercises where planned_session_id = p_session and not (id = any (v_keep));
  -- Positions provisoires négatives : réordonner sans heurter la clé unique (séance, position)
  update public.planned_exercises set position = -position where planned_session_id = p_session;

  insert into public.planned_exercises
    (id, planned_session_id, exercise_id, position, block_label, sets, reps, load_value, load_unit, tempo, rest, instructions)
  select coalesce((e->>'id')::uuid, gen_random_uuid()), p_session, (e->>'exercise_id')::uuid, ord::int,
         nullif(e->>'block_label', ''), (e->>'sets')::int, nullif(e->>'reps', ''), (e->>'load_value')::numeric,
         nullif(e->>'load_unit', ''), nullif(e->>'tempo', ''), nullif(e->>'rest', ''), nullif(e->>'instructions', '')
  from jsonb_array_elements(p_exercises) with ordinality as x(e, ord)
  on conflict (id) do update set
    exercise_id = excluded.exercise_id, position = excluded.position, block_label = excluded.block_label,
    sets = excluded.sets, reps = excluded.reps, load_value = excluded.load_value, load_unit = excluded.load_unit,
    tempo = excluded.tempo, rest = excluded.rest, instructions = excluded.instructions;
end $$;

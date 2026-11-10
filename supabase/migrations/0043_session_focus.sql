-- Intitulé de séance (décision du 10/11/2026) : « Lundi - Puissance BDC » sur la ligne du jour de la fiche devient
-- planned_sessions.focus (déjà recopié par duplicate_week). Seul changement : focus à la création et au remplacement.
create or replace function public.import_muscu_program(p_player uuid, p_sessions jsonb, p_season text, p_targets jsonb default '[]')
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_activity uuid;
  v_name text;
  v_duration int;
  v_s jsonb;
  v_date date;
  v_session uuid;
  v_created int := 0;
  v_replaced int := 0;
  v_kept int := 0;
  v_past int := 0;
begin
  if not public.is_staff() then raise exception 'réservé au staff' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_player and role = 'player') then
    raise exception 'joueur introuvable' using errcode = 'P0002';
  end if;
  if exists (select 1 from jsonb_array_elements(p_sessions) s, jsonb_array_elements(s->'exercises') e
             where e->>'load_value' is not null and e->>'load_value' !~ '^\d{1,4}(\.\d+)?$') then
    raise exception 'charge invalide' using errcode = 'P0001';
  end if;

  -- Exercices inconnus de la bibliothèque : créés (nom unique sans tenir compte de la casse, migration 0013)
  insert into public.exercises (name)
  select distinct on (lower(trim(e->>'name'))) trim(e->>'name')
  from jsonb_array_elements(p_sessions) s, jsonb_array_elements(s->'exercises') e
  where trim(coalesce(e->>'name', '')) <> ''
  on conflict ((lower(trim(name)))) do nothing;

  for v_s in select * from jsonb_array_elements(p_sessions) loop
    v_date := (v_s->>'date')::date;
    if v_date < public.paris_today() then v_past := v_past + 1; continue; end if;
    -- Séance à exercices : Musculation (par défaut), Réhabilitation ou Membres sains (blessé : deux séances le même jour)
    select id, coalesce(default_duration_min, 60), name into v_activity, v_duration, v_name from public.activity_types
    where name = coalesce(nullif(v_s->>'activity', ''), 'Musculation') and name in ('Musculation', 'Réhabilitation', 'Membres sains');
    if v_activity is null then raise exception 'activité « % » inconnue', v_s->>'activity' using errcode = 'P0001'; end if;
    v_session := null;

    select id into v_session from public.planned_sessions
    where player_id = p_player and session_date = v_date and activity_type_id = v_activity
    for update; -- un retour saisi pendant l'import ne peut pas être effacé en cascade
    -- Le joueur a répondu (un exercice, ou le RPE de la séance) : la séance reste telle qu'il l'a faite
    if v_session is not null and (exists (
      select 1 from public.planned_exercises pe join public.exercise_feedback f on f.planned_exercise_id = pe.id
      where pe.planned_session_id = v_session
    ) or exists (select 1 from public.session_logs sl where sl.planned_session_id = v_session))
    then v_kept := v_kept + 1; continue; end if;

    if v_session is null then
      insert into public.planned_sessions (session_date, title, focus, player_id, activity_type_id, planned_duration_min, created_by)
      values (v_date, v_name, left(nullif(trim(v_s->>'focus'), ''), 80), p_player, v_activity, v_duration, auth.uid()) returning id into v_session;
      v_created := v_created + 1;
    else
      delete from public.planned_exercises where planned_session_id = v_session;
      update public.planned_sessions set focus = left(nullif(trim(v_s->>'focus'), ''), 80) where id = v_session;
      v_replaced := v_replaced + 1;
    end if;

    insert into public.planned_exercises
      (planned_session_id, exercise_id, position, block_label, sets, reps, load_value, load_unit, tempo, rest, instructions)
    select v_session, ex.id, ord::int, nullif(e->>'block_label', ''), (e->>'sets')::int, nullif(e->>'reps', ''),
           (e->>'load_value')::numeric, nullif(e->>'load_unit', ''), nullif(e->>'tempo', ''), nullif(e->>'rest', ''),
           nullif(e->>'instructions', '')
    from jsonb_array_elements(v_s->'exercises') with ordinality as x(e, ord)
    join public.exercises ex on lower(trim(ex.name)) = lower(trim(e->>'name'));
  end loop;

  insert into public.player_targets (player_id, season, test_id, target_value, label)
  select p_player, p_season, (t->>'test_id')::uuid, (t->>'value')::numeric, nullif(t->>'label', '')
  from jsonb_array_elements(p_targets) t
  on conflict (player_id, season, test_id) do update set target_value = excluded.target_value, label = coalesce(excluded.label, public.player_targets.label);

  return jsonb_build_object('created', v_created, 'replaced', v_replaced, 'kept', v_kept, 'past', v_past,
                            'targets', jsonb_array_length(p_targets));
end $$;

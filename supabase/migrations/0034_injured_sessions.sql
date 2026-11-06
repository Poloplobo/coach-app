-- Joueur blessé (décision du 06/11/2026) : deux séances à exercices par jour, Réhabilitation et Membres sains, en plus de
-- la Musculation des joueurs aptes ; il ajoute lui-même Cardio (porté / course) et Reprise terrain. Douleur EVA (0 à 10)
-- saisie par exercice pour suivre sa progression. Les fonctions de séance (import, suppression, validation du soir,
-- reprise d'une séance manquée) acceptent désormais ces trois types.
insert into public.activity_types (name, pillar, requires_rpe, default_duration_min)
values ('Cardio (porté / course)', 'physique', true, 30) on conflict (name) do nothing;

alter table public.exercise_feedback add column pain smallint check (pain between 0 and 10); -- EVA : 0 aucune, 10 maximale

-- Import d'une fiche : chaque séance porte son activité (« activity »), Musculation par défaut
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
      insert into public.planned_sessions (session_date, title, player_id, activity_type_id, planned_duration_min, created_by)
      values (v_date, v_name, p_player, v_activity, v_duration, auth.uid()) returning id into v_session;
      v_created := v_created + 1;
    else
      delete from public.planned_exercises where planned_session_id = v_session;
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

-- Suppression d'une séance à venir sans réponse : les trois types de séance à exercices
create or replace function public.delete_muscu_session(p_session uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_date date;
begin
  if not public.is_staff() then raise exception 'réservé au staff' using errcode = '42501'; end if;
  select ps.session_date into v_date from public.planned_sessions ps
  join public.activity_types a on a.id = ps.activity_type_id and a.name in ('Musculation', 'Réhabilitation', 'Membres sains')
  where ps.id = p_session and ps.player_id is not null
  for update;
  if v_date is null then raise exception 'séance de musculation introuvable' using errcode = 'P0002'; end if;
  if v_date < public.paris_today() then raise exception 'séance passée : l''historique ne se supprime pas' using errcode = 'P0001'; end if;
  if exists (select 1 from public.planned_exercises pe join public.exercise_feedback f on f.planned_exercise_id = pe.id
             where pe.planned_session_id = p_session)
     or exists (select 1 from public.session_logs sl where sl.planned_session_id = p_session) then
    raise exception 'le joueur a déjà répondu à cette séance : elle ne se supprime pas' using errcode = 'P0001';
  end if;
  delete from public.planned_sessions where id = p_session;
end $$;

-- Validation du soir (0029) : les trois types, chacun avec son activité
create or replace function public.auto_validate_muscu(p_date date) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select ps.id, ps.player_id, ps.activity_type_id, coalesce(ps.planned_duration_min, a.default_duration_min, 60) as duration,
           round(avg(f.rpe) filter (where f.status <> 'non fait' and f.rpe is not null), 1) as rpe
    from public.planned_sessions ps
    join public.activity_types a on a.id = ps.activity_type_id and a.name in ('Musculation', 'Réhabilitation', 'Membres sains')
    join public.planned_exercises pe on pe.planned_session_id = ps.id
    join public.exercise_feedback f on f.planned_exercise_id = pe.id and f.player_id = ps.player_id
    where ps.session_date = p_date and ps.player_id is not null
      and not exists (select 1 from public.session_logs l
                      where l.player_id = ps.player_id and l.session_date = p_date and l.activity_type_id = ps.activity_type_id)
    group by ps.id, a.default_duration_min
  loop
    continue when r.rpe is null;
    insert into public.exercise_feedback (player_id, planned_exercise_id, status)
    select r.player_id, pe.id, 'non fait' from public.planned_exercises pe where pe.planned_session_id = r.id
    on conflict (player_id, planned_exercise_id) do nothing;
    insert into public.session_logs (player_id, planned_session_id, session_date, activity_type_id, duration_min, rpe, validated_at, source)
    values (r.player_id, r.id, p_date, r.activity_type_id, r.duration, r.rpe, now(), 'auto')
    on conflict (player_id, session_date, activity_type_id) do nothing;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.auto_validate_muscu(date) from public, authenticated;

-- Reprise d'une séance manquée (0033) : les trois types ; une seule séance de chaque type par jour
create or replace function public.redo_muscu_session(p_session uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_session public.planned_sessions;
  v_today date := public.paris_today();
begin
  select ps.* into v_session from public.planned_sessions ps
  join public.activity_types a on a.id = ps.activity_type_id and a.name in ('Musculation', 'Réhabilitation', 'Membres sains')
  where ps.id = p_session and ps.player_id = auth.uid()
  for update of ps;
  if v_session.id is null then raise exception 'séance introuvable' using errcode = 'P0002'; end if;
  if v_session.session_date >= v_today or date_trunc('week', v_session.session_date) <> date_trunc('week', v_today) then
    raise exception 'seule une séance d''un jour passé de cette semaine peut être reprise' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.session_logs where planned_session_id = v_session.id and validated_at is not null) then
    raise exception 'séance déjà validée' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.planned_sessions where player_id = auth.uid() and activity_type_id = v_session.activity_type_id and session_date = v_today)
     or exists (select 1 from public.session_logs where player_id = auth.uid() and activity_type_id = v_session.activity_type_id and session_date = v_today) then
    raise exception 'tu as déjà une séance de ce type aujourd''hui' using errcode = 'P0001';
  end if;
  delete from public.exercise_feedback f using public.planned_exercises pe
  where pe.id = f.planned_exercise_id and pe.planned_session_id = v_session.id and f.player_id = auth.uid();
  update public.planned_sessions set session_date = v_today where id = v_session.id;
end $$;
revoke execute on function public.redo_muscu_session(uuid) from public, anon;

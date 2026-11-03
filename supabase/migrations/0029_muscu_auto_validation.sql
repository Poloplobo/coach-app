-- Validation automatique de la musculation (décision du 03/11/2026) : le 02/11, 5 joueurs ont rempli leurs exercices
-- sans valider la séance, leur sRPE de muscu manquait. Chaque soir à 23h30 (heure de Paris), une séance remplie mais non
-- validée est enregistrée : RPE = moyenne des RPE des exercices faits ou partiels (comme dans l'app), durée prévue,
-- exercices sans réponse en « non fait ». Sans aucun RPE d'exercice, rien n'est mesurable : la séance reste telle quelle.
alter table public.session_logs drop constraint session_logs_source_check;
alter table public.session_logs add constraint session_logs_source_check check (source in ('app', 'import_form', 'staff', 'auto'));

create function public.auto_validate_muscu(p_date date) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_type uuid;
  v_default int;
  r record;
  v_n int := 0;
begin
  select id, default_duration_min into v_type, v_default from public.activity_types where name = 'Musculation';
  for r in
    select ps.id, ps.player_id, coalesce(ps.planned_duration_min, v_default, 60) as duration,
           round(avg(f.rpe) filter (where f.status <> 'non fait' and f.rpe is not null), 1) as rpe
    from public.planned_sessions ps
    join public.planned_exercises pe on pe.planned_session_id = ps.id
    join public.exercise_feedback f on f.planned_exercise_id = pe.id and f.player_id = ps.player_id
    where ps.session_date = p_date and ps.activity_type_id = v_type and ps.player_id is not null
      and not exists (select 1 from public.session_logs l
                      where l.player_id = ps.player_id and l.session_date = p_date and l.activity_type_id = v_type)
    group by ps.id
  loop
    continue when r.rpe is null;
    insert into public.exercise_feedback (player_id, planned_exercise_id, status)
    select r.player_id, pe.id, 'non fait' from public.planned_exercises pe where pe.planned_session_id = r.id
    on conflict (player_id, planned_exercise_id) do nothing;
    insert into public.session_logs (player_id, planned_session_id, session_date, activity_type_id, duration_min, rpe, validated_at, source)
    values (r.player_id, r.id, p_date, v_type, r.duration, r.rpe, now(), 'auto')
    on conflict (player_id, session_date, activity_type_id) do nothing;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.auto_validate_muscu(date) from public, authenticated;

-- 23h30 à Paris = 22h30 UTC en hiver, 21h30 UTC en été : les deux passages, seul celui de 23h agit
select cron.schedule('muscu-auto-validation', '30 21,22 * * *',
  $$select public.auto_validate_muscu(public.paris_today()) where extract(hour from now() at time zone 'Europe/Paris') = 23$$);

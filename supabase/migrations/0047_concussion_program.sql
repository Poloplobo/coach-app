-- Séances d'un joueur en protocole commotion (décision du 11/11/2026) : elles suivent l'étape en cours de son plan.
-- À la déclaration et à chaque étape validée (ou annulée) : les séances de musculation à venir sans réponse et les anciennes
-- séances du protocole sont retirées, puis celles du palier en cours sont programmées sur 2 semaines, les jours
-- d'entraînement (lundi, mardi, mercredi, vendredi). Jamais de contact avant la date FFR (injuries.contact_on).
--   palier 1 (repos), palier 6 : aucune séance
--   palier 2 : réhab « aérobie léger » (vélo, marche)
--   palier 3 : reprise terrain « course et appuis, sans contact »
--   palier 4 et avis médical : réhab « musculation progressive » + reprise terrain « entraînement sans contact »
--   palier 5 : reprise terrain « entraînement avec contact » (avant la date FFR : séances du palier 4)
alter table public.injuries add column contact_on date;
update public.injuries set contact_on = occurred_on
  + (case when diagnosis like '%moins de 18 ans%' then array[23, 42, 180] else array[10, 22, 91] end)[concussion_rank]
where concussion_rank is not null;

-- Une séance du protocole : titre « Protocole commotion » (reconnue et remplacée à chaque étape), exercices créés au besoin
create function public.concussion_session(p_player uuid, p_date date, p_activity text, p_minutes int, p_focus text, p_exercises jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_session uuid;
begin
  insert into public.exercises (name)
  select trim(e->>'name') from jsonb_array_elements(p_exercises) e on conflict ((lower(trim(name)))) do nothing;
  insert into public.planned_sessions (session_date, title, focus, player_id, activity_type_id, planned_duration_min)
  select p_date, 'Protocole commotion', p_focus, p_player, a.id, p_minutes from public.activity_types a where a.name = p_activity
  on conflict do nothing returning id into v_session;
  if v_session is null then return; end if; -- déjà là (séance du jour déjà commencée par le joueur)
  insert into public.planned_exercises (planned_session_id, exercise_id, position, block_label, sets, reps, instructions)
  select v_session, x.id, ord::int, e->>'block', (e->>'sets')::int, e->>'reps', e->>'note'
  from jsonb_array_elements(p_exercises) with ordinality as t(e, ord)
  join public.exercises x on lower(trim(x.name)) = lower(trim(e->>'name'));
end $$;
revoke execute on function public.concussion_session(uuid, date, text, int, text, jsonb) from public, anon, authenticated;

create function public.concussion_program(p_injury uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inj public.injuries;
  v_step text;
  v_level int;
  v_lv int;
  v_today date := public.paris_today();
  d date;
  n int := 0;
  v_stop constant text := 'Arrête dès qu''un symptôme apparaît (mal de tête, vertige, nausée…) et préviens le staff.';
begin
  if not public.is_staff() then raise exception 'réservé au staff' using errcode = '42501'; end if;
  select * into v_inj from public.injuries where id = p_injury and concussion_rank is not null and ended_on is null;
  if v_inj.id is null then return 0; end if;
  select title into v_step from public.injury_steps where injury_id = p_injury and validated_on is null order by position limit 1;
  v_level := case when v_step like 'Palier 2%' then 2 when v_step like 'Palier 3%' then 3
                  when v_step like 'Palier 4%' or v_step like 'Avis%' then 4 when v_step like 'Palier 5%' then 5 else 0 end;

  -- Séances à venir sans réponse : musculation habituelle et séances du protocole de l'étape précédente
  delete from public.planned_sessions ps
  where ps.player_id = v_inj.player_id and ps.session_date >= v_today
    and (ps.title = 'Protocole commotion' or ps.activity_type_id = (select id from public.activity_types where name = 'Musculation'))
    and not exists (select 1 from public.planned_exercises pe join public.exercise_feedback f on f.planned_exercise_id = pe.id where pe.planned_session_id = ps.id)
    and not exists (select 1 from public.session_logs l where l.planned_session_id = ps.id);

  for d in select g::date from generate_series(v_today, v_today + 13, interval '1 day') g where extract(isodow from g) in (1, 2, 3, 5) loop
    v_lv := case when v_level = 5 and d < v_inj.contact_on then 4 else v_level end; -- pas de contact avant la date FFR
    if v_lv = 2 then
      perform public.concussion_session(v_inj.player_id, d, 'Réhabilitation', 30, 'Palier 2 · Aérobie léger', jsonb_build_array(
        jsonb_build_object('block', 'A1', 'name', 'Vélo d''appartement', 'sets', 1, 'reps', '20''', 'note', 'Intensité faible : tu peux parler sans être essoufflé. ' || v_stop),
        jsonb_build_object('block', 'B1', 'name', 'Marche', 'sets', 1, 'reps', '10''', 'note', 'Allure tranquille.')));
    elsif v_lv = 3 then
      perform public.concussion_session(v_inj.player_id, d, 'Reprise terrain', 30, 'Palier 3 · Course et appuis, sans contact', '[]');
    elsif v_lv = 4 then
      perform public.concussion_session(v_inj.player_id, d, 'Réhabilitation', 45, 'Palier 4 · Musculation progressive', jsonb_build_array(
        jsonb_build_object('block', 'A1', 'name', 'Goblet Squat', 'sets', 3, 'reps', '10', 'note', 'Charge légère. ' || v_stop),
        jsonb_build_object('block', 'A2', 'name', 'Pompes', 'sets', 3, 'reps', '10', 'note', null),
        jsonb_build_object('block', 'B1', 'name', 'Rowing haltère', 'sets', 3, 'reps', '10/côté', 'note', 'Charge légère.'),
        jsonb_build_object('block', 'C1', 'name', 'Gainage', 'sets', 3, 'reps', '30''''', 'note', 'Pas de position tête en bas.')));
      perform public.concussion_session(v_inj.player_id, d, 'Reprise terrain', 60, 'Palier 4 · Entraînement sans contact', '[]');
    elsif v_lv = 5 then
      perform public.concussion_session(v_inj.player_id, d, 'Reprise terrain', 90, 'Palier 5 · Entraînement avec contact', '[]');
    else continue;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.concussion_program(uuid) from public, anon;
grant execute on function public.concussion_program(uuid) to authenticated;

-- Étape validée ou annulée : les séances suivent
create function public.concussion_step_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.injuries where id = new.injury_id and concussion_rank is not null and ended_on is null) then
    perform public.concussion_program(new.injury_id);
  end if;
  return null;
end $$;
revoke execute on function public.concussion_step_changed() from public, anon, authenticated;
create trigger concussion_step_changed after update of validated_on on public.injury_steps
  for each row when (old.validated_on is distinct from new.validated_on) execute function public.concussion_step_changed();

-- Déclaration : la date de contact est gardée et les séances du protocole sont programmées tout de suite
create or replace function public.declare_concussion_with_program(p_player uuid, p_occurred_on date, p_minor boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  r := public.declare_concussion(p_player, p_occurred_on, p_minor);
  update public.injuries set contact_on = (r->>'contact_on')::date where id = (r->>'injury')::uuid;
  perform public.concussion_program((r->>'injury')::uuid);
  return r;
end $$;
revoke execute on function public.declare_concussion_with_program(uuid, date, boolean) from public, anon;
grant execute on function public.declare_concussion_with_program(uuid, date, boolean) to authenticated;

-- Joueurs déjà en protocole (Evan GERARD, déclaré le 11/11) : séances programmées maintenant, hors contrôle staff (migration)
do $$
declare r record;
begin
  for r in select id from public.injuries where concussion_rank is not null and ended_on is null loop
    perform set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where role = 'admin' order by created_at limit 1), 'role', 'authenticated')::text, true);
    perform public.concussion_program(r.id);
  end loop;
end $$;

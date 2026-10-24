-- Rugby Tracker — suivi individuel PER
-- Calqué sur :
--   « Planification individuelle PER » (doc)       -> player_season_profiles, player_targets, body_measurements
--   « <Joueur> : PER MUSCULATION » onglets C1S1…   -> planned_exercises (blocs A1/B1, tempo, repos) + exercise_feedback
--   onglet SYNTHÈSE_CYCLES                          -> cycles + player_cycle_reviews
--   onglet TESTS                                    -> test_definitions (référentiel ci-dessous) + test_results

-- ============ CYCLES ============

create table public.cycles (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  name       text not null,                 -- 'Cycle 2'
  first_week text,                          -- 'S4'
  last_week  text,                          -- 'S6'
  focus      text,                          -- 'Puissance MAX'
  objective  text,
  unique (group_id, name)
);

-- Bilan de cycle par joueur (SYNTHÈSE_CYCLES)
create table public.player_cycle_reviews (
  id                   uuid primary key default gen_random_uuid(),
  player_id            uuid not null references public.profiles(id) on delete cascade,
  cycle_id             uuid not null references public.cycles(id) on delete cascade,
  status               text check (status in ('planifié', 'en cours', 'validé')),
  key_session          text,                -- 'Lundi (5,2)'
  strength_progression text,                -- 'Front Squat +40% | DC +7%'
  mobility_review      text,
  coach_directives     text,
  unique (player_id, cycle_id)
);

-- ============ PROFIL ATHLÈTE PAR SAISON ============

create table public.player_season_profiles (
  id                uuid primary key default gen_random_uuid(),
  player_id         uuid not null references public.profiles(id) on delete cascade,
  season            text not null,          -- '2026-2027'
  profile_type      text,                   -- VITESSE, ÉNERGÉTIQUE, FORCE/PUISSANCE, PHYSIQUE, MÊLÉE
  main_objective    text,                   -- 'Développer mon armure : passer mes mouvements au barème vert'
  health_objective  text,                   -- zone de prévention (genou, épaule, hanche…) : donnée sensible
  power_to_develop  text,                   -- 'VITESSE : augmenter ma Vmax à 34 km/h'
  weekly_template   text,                   -- semaine type (texte libre au départ)
  unique (player_id, season)
);

-- Objectifs chiffrés : DC 100 kg 1RM, BS 2xPDC, Traction 15, Force RC 50 N/kg…
create table public.player_targets (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.profiles(id) on delete cascade,
  season       text not null,
  test_id      uuid not null references public.test_definitions(id),
  target_value numeric not null,
  label        text,                        -- formulation d'origine, ex. '2xPDC (142 kg)'
  unique (player_id, season, test_id)
);

create table public.body_measurements (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.profiles(id) on delete cascade,
  measured_on date not null,
  weight_kg   numeric(5,1),
  height_cm   numeric(5,1),
  unique (player_id, measured_on)
);

-- ============ PROGRAMME MUSCULATION ============

alter table public.exercises
  add column abbreviation text;             -- DC, BS, FS, DM, GHD, KB…

alter table public.planned_exercises
  add column block_label text,              -- 'MOB', 'A1', 'A2', 'B1', 'F' (finisher)
  add column tempo       text,              -- '4.0.1.0'
  add column rest        text,              -- "2'30", 'E2OM'
  add column load_value  numeric,
  add column load_unit   text check (load_unit in ('pct_rm', 'kg', 'bw', 'free')); -- %RM, kg, poids du corps, libre
-- reps reste du texte : '5', "30''", '6/côté', 'AMRAP', '2 + 2'

-- Retour du joueur par exercice (colonnes RPE / Charge / Statut / Commentaires des fiches)
create table public.exercise_feedback (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null references public.profiles(id) on delete cascade,
  planned_exercise_id uuid not null references public.planned_exercises(id) on delete cascade,
  session_log_id      uuid references public.session_logs(id) on delete set null,
  rpe                 numeric(3,1) check (rpe between 0 and 10),
  done_load           text,                 -- tel que saisi : '2x125 1x120', '5x45'
  status              text check (status in ('fait', 'partiel', 'non fait')),
  comment             text,                 -- 'Mal de dos', 'Manque de temps'
  created_at          timestamptz not null default now(),
  unique (player_id, planned_exercise_id)
);

-- Taux de complétion d'une séance pour un joueur
create view public.session_completion with (security_invoker = true) as
with totals as (
  select planned_session_id, count(*) as exercises
  from public.planned_exercises group by planned_session_id
)
select pe.planned_session_id, ef.player_id, t.exercises,
       count(*) filter (where ef.status = 'fait')                         as done,
       round(100.0 * count(*) filter (where ef.status = 'fait') / t.exercises) as completion_pct,
       round(avg(ef.rpe), 1)                                              as avg_rpe
from public.exercise_feedback ef
join public.planned_exercises pe on pe.id = ef.planned_exercise_id
join totals t on t.planned_session_id = pe.planned_session_id
group by pe.planned_session_id, ef.player_id, t.exercises;

-- ============ RLS ============

alter table public.cycles                 enable row level security;
alter table public.player_cycle_reviews   enable row level security;
alter table public.player_season_profiles enable row level security;
alter table public.player_targets         enable row level security;
alter table public.body_measurements      enable row level security;
alter table public.exercise_feedback      enable row level security;

create policy "cycles_read"  on public.cycles for select using (auth.uid() is not null);
create policy "cycles_staff" on public.cycles for all using (public.is_staff()) with check (public.is_staff());

-- Fiches individuelles : le joueur lit la sienne, seul le staff écrit
create policy "reviews_read"   on public.player_cycle_reviews   for select using (player_id = auth.uid() or public.is_staff());
create policy "reviews_staff"  on public.player_cycle_reviews   for all using (public.is_staff()) with check (public.is_staff());
create policy "profiles_s_read"  on public.player_season_profiles for select using (player_id = auth.uid() or public.is_staff());
create policy "profiles_s_staff" on public.player_season_profiles for all using (public.is_staff()) with check (public.is_staff());
create policy "targets_read"   on public.player_targets for select using (player_id = auth.uid() or public.is_staff());
create policy "targets_staff"  on public.player_targets for all using (public.is_staff()) with check (public.is_staff());
create policy "body_read"      on public.body_measurements for select using (player_id = auth.uid() or public.is_staff());
create policy "body_staff"     on public.body_measurements for all using (public.is_staff()) with check (public.is_staff());

-- Retours d'exercice : le joueur saisit les siens
create policy "feedback_own" on public.exercise_feedback for all
  using (player_id = auth.uid() or public.is_staff())
  with check (player_id = auth.uid() or public.is_staff());

-- ============ RÉFÉRENTIEL DES TESTS (fiches « Test à réaliser » et onglet TESTS) ============

insert into public.test_definitions (name, category, unit, higher_is_better) values
  ('Développé Couché 1RM',     'force',       'kg',   true),
  ('Développé Militaire 1RM',  'force',       'kg',   true),
  ('Front Squat 3RM',          'force',       'kg',   true),
  ('Back Squat 1RM',           'force',       'kg',   true),
  ('Traction Stricte',         'force',       'reps', true),
  ('CMJ',                      'puissance',   'cm',   true),
  ('Broad Jump',               'puissance',   'cm',   true),
  ('Sprint 10m',               'vitesse',     's',    false),
  ('Sprint 50m',               'vitesse',     's',    false),
  ('10m Fly',                  'vitesse',     's',    false),
  ('Vmax',                     'vitesse',     'km/h', true),
  ('Yo-Yo Test',               'énergétique', 'm',    true),
  ('Force Cervicale',          'cervicale',   'N/kg', true),
  ('Gainage Planche',          'cervicale',   's',    true);

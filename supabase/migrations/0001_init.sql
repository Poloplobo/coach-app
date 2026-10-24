-- Rugby Tracker — schéma initial
-- Joueurs, groupes, programmation de séances, RPE, wellness, tests physiques.

-- ============ PROFILS & GROUPES ============

create type public.user_role as enum ('player', 'coach', 'admin');

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null default 'player',
  first_name  text not null,
  last_name   text not null,
  position    text,
  birth_date  date,
  height_cm   numeric(5,1),
  weight_kg   numeric(5,1),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Fonction utilitaire pour la RLS : l'utilisateur courant est-il du staff ?
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('coach','admin'));
$$;

create table public.groups (
  id     uuid primary key default gen_random_uuid(),
  name   text not null unique,          -- ex. 'Crabos 26/27', 'Pôle Espoir'
  season text not null                  -- ex. '2026-2027'
);

create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  primary key (group_id, player_id)
);

-- ============ BIBLIOTHÈQUE & PROGRAMMATION ============

create table public.exercises (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  category  text,                       -- force, puissance, vitesse, mobilité…
  video_url text,
  notes     text
);

-- Une séance planifiée vise un groupe OU un joueur (suivi individuel Pôle Espoir).
create table public.planned_sessions (
  id                   uuid primary key default gen_random_uuid(),
  session_date         date not null,
  title                text not null,
  focus                text,            -- 'Force max', 'Puissance / VBT'…
  planned_duration_min int check (planned_duration_min > 0),
  planned_rpe          numeric(3,1) check (planned_rpe between 0 and 10),
  group_id             uuid references public.groups(id) on delete cascade,
  player_id            uuid references public.profiles(id) on delete cascade,
  created_by           uuid references public.profiles(id),
  created_at           timestamptz not null default now(),
  constraint target_xor check ((group_id is null) <> (player_id is null))
);
create index on public.planned_sessions (session_date);

create table public.planned_exercises (
  id                 uuid primary key default gen_random_uuid(),
  planned_session_id uuid not null references public.planned_sessions(id) on delete cascade,
  exercise_id        uuid not null references public.exercises(id),
  position           int not null,      -- ordre dans la séance
  sets               int,
  reps               text,              -- '5', '3-5', '4 sec'
  load_pct           numeric(5,1),      -- % du 1RM
  target_velocity    numeric(4,2),      -- m/s (VBT)
  instructions       text
);

-- ============ RÉALISÉ : SÉANCES & RPE ============

create table public.session_logs (
  id                 uuid primary key default gen_random_uuid(),
  player_id          uuid not null references public.profiles(id) on delete cascade,
  planned_session_id uuid references public.planned_sessions(id) on delete set null,
  session_date       date not null default current_date,
  session_type       text,              -- muscu, terrain, match…
  duration_min       int not null check (duration_min > 0),
  rpe                numeric(3,1) check (rpe between 0 and 10),   -- échelle CR-10 ; null = activité sans RPE (vidéo, soins)
  srpe               numeric generated always as (coalesce(rpe, 0) * duration_min) stored, -- charge en UA
  comment            text,
  created_at         timestamptz not null default now()
);
create index on public.session_logs (player_id, session_date);

create table public.set_logs (
  id                  uuid primary key default gen_random_uuid(),
  session_log_id      uuid not null references public.session_logs(id) on delete cascade,
  planned_exercise_id uuid references public.planned_exercises(id) on delete set null,
  exercise_id         uuid not null references public.exercises(id),
  set_number          int not null,
  load_kg             numeric(6,2),
  reps                int,
  velocity            numeric(4,2)      -- m/s mesurée
);

-- ============ WELLNESS ============
-- Tous les items : 1 = très mauvais, 5 = excellent (pas d'échelle inversée).
create table public.wellness_entries (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.profiles(id) on delete cascade,
  entry_date    date not null default current_date,
  sleep_quality smallint not null check (sleep_quality between 1 and 5),
  sleep_hours   numeric(3,1) check (sleep_hours between 0 and 24),
  fatigue       smallint not null check (fatigue between 1 and 5),
  soreness      smallint not null check (soreness between 1 and 5),
  stress        smallint not null check (stress between 1 and 5),
  mood          smallint not null check (mood between 1 and 5),
  score         numeric generated always as ((sleep_quality + fatigue + soreness + stress + mood) * 4) stored, -- /100
  comment       text,
  created_at    timestamptz not null default now(),
  unique (player_id, entry_date)
);

-- ============ TESTS PHYSIQUES ============

create table public.test_definitions (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,  -- 'Back Squat 1RM', 'Sprint 10m', 'Yo-Yo'…
  category         text,                  -- musculation, vitesse, endurance, puissance, cervicale
  unit             text not null,         -- kg, s, m, cm…
  higher_is_better boolean not null default true
);

create table public.test_results (
  id        uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  test_id   uuid not null references public.test_definitions(id),
  test_date date not null,
  period    text check (period in ('P1','P2','P3')),
  value     numeric not null,
  notes     text,
  unique (player_id, test_id, test_date)
);

-- ============ VUES D'ANALYSE ============

-- Charge hebdomadaire par joueur (semaine ISO, début lundi)
create view public.weekly_load with (security_invoker = true) as
select
  player_id,
  date_trunc('week', session_date)::date as week_start,
  count(*)                               as sessions,
  sum(duration_min)                      as total_minutes,
  sum(srpe)                              as weekly_load,
  round(avg(rpe), 1)                     as avg_rpe
from public.session_logs
group by player_id, date_trunc('week', session_date);

-- ============ RLS ============

alter table public.profiles          enable row level security;
alter table public.groups            enable row level security;
alter table public.group_members     enable row level security;
alter table public.exercises         enable row level security;
alter table public.planned_sessions  enable row level security;
alter table public.planned_exercises enable row level security;
alter table public.session_logs      enable row level security;
alter table public.set_logs          enable row level security;
alter table public.wellness_entries  enable row level security;
alter table public.test_definitions  enable row level security;
alter table public.test_results      enable row level security;

-- Profils : chacun voit le sien, le staff voit et gère tout
create policy "profiles_select" on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy "profiles_staff_write" on public.profiles for all using (public.is_staff()) with check (public.is_staff());

-- Référentiels lisibles par tous les connectés, modifiables par le staff
create policy "groups_read" on public.groups for select using (auth.uid() is not null);
create policy "groups_staff" on public.groups for all using (public.is_staff()) with check (public.is_staff());
create policy "members_read" on public.group_members for select using (player_id = auth.uid() or public.is_staff());
create policy "members_staff" on public.group_members for all using (public.is_staff()) with check (public.is_staff());
create policy "exercises_read" on public.exercises for select using (auth.uid() is not null);
create policy "exercises_staff" on public.exercises for all using (public.is_staff()) with check (public.is_staff());
create policy "tests_def_read" on public.test_definitions for select using (auth.uid() is not null);
create policy "tests_def_staff" on public.test_definitions for all using (public.is_staff()) with check (public.is_staff());

-- Séances planifiées : le joueur voit les siennes et celles de ses groupes
create policy "planned_read" on public.planned_sessions for select using (
  public.is_staff()
  or player_id = auth.uid()
  or group_id in (select group_id from public.group_members where player_id = auth.uid())
);
create policy "planned_staff" on public.planned_sessions for all using (public.is_staff()) with check (public.is_staff());
create policy "planned_ex_read" on public.planned_exercises for select using (
  exists (select 1 from public.planned_sessions ps where ps.id = planned_session_id)  -- filtré par la RLS de planned_sessions
);
create policy "planned_ex_staff" on public.planned_exercises for all using (public.is_staff()) with check (public.is_staff());

-- Données du joueur : il gère les siennes, le staff lit et corrige tout
create policy "logs_own" on public.session_logs for all
  using (player_id = auth.uid() or public.is_staff())
  with check (player_id = auth.uid() or public.is_staff());
create policy "sets_own" on public.set_logs for all
  using (exists (select 1 from public.session_logs sl where sl.id = session_log_id and (sl.player_id = auth.uid() or public.is_staff())))
  with check (exists (select 1 from public.session_logs sl where sl.id = session_log_id and (sl.player_id = auth.uid() or public.is_staff())));
create policy "wellness_own" on public.wellness_entries for all
  using (player_id = auth.uid() or public.is_staff())
  with check (player_id = auth.uid() or public.is_staff());
-- Tests : saisis par le staff, consultables par le joueur concerné
create policy "results_read" on public.test_results for select using (player_id = auth.uid() or public.is_staff());
create policy "results_staff" on public.test_results for all using (public.is_staff()) with check (public.is_staff());

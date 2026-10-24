-- Rugby Tracker — modèle PER (Pôle Espoirs Rugby)
-- Calqué sur le classeur « CHARGE D'ENTRAINEMENT - PER » :
--   CONFIG_SEMAINES_PER  -> week_types + season_weeks
--   PLANNING_CHARGES     -> activity_types + planned_sessions (une ligne = une activité d'un jour)
--   BASE_REPONSES_SRPE_* -> session_logs (une ligne = le RPE d'une activité)
--   SUIVI_INDIVIDUEL / TABLEAU_DE_BORD -> vues weekly_player_load et weekly_group_load

-- ============ RÉFÉRENTIELS PER ============

create type public.per_pillar as enum ('rugby', 'physique', 'accompagnement', 'ppid');

-- Activités types : Dév. Tactique, Musculation, Jeu au Poste, Vidéo, Collectif Total…
create table public.activity_types (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null unique,
  pillar               public.per_pillar not null,
  default_duration_min int check (default_duration_min > 0),
  requires_rpe         boolean not null default true   -- false pour Vidéo, Kiné & Soins, Récupération
);

-- Types de semaine : DEV / COMP / REG (préconisations fédérales)
create table public.week_types (
  code                 text primary key,               -- 'DEV', 'COMP', 'REG'
  name                 text not null,
  volume_min           int  not null,
  physique_min         int  not null,
  rugby_min            int  not null,
  accompagnement_min   int  not null,
  ppid_min             int  not null,
  target_srpe          int  not null,                  -- UA
  srpe_min             int,                            -- plage recommandée
  srpe_max             int,
  guidance             text
);

-- Calendrier de la saison : S1, S2… rattachées à un type de semaine et un cycle
create table public.season_weeks (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.groups(id) on delete cascade,
  code           text not null,                        -- 'S1'
  label          text,                                 -- 'Semaine 1 (Nantes)'
  start_date     date not null check (extract(isodow from start_date) = 1), -- un lundi
  week_type_code text not null references public.week_types(code),
  cycle          text,                                 -- 'Cycle 1'
  phase_note     text,
  unique (group_id, code),
  unique (group_id, start_date)
);

-- ============ RATTACHEMENT DES SÉANCES ============

-- Planifié : une ligne = une activité (ex. Mardi · Musculation · 60 min) pour un groupe ou un joueur.
alter table public.planned_sessions
  add column activity_type_id uuid references public.activity_types(id);

-- Réalisé : une ligne = une activité déclarée avec son RPE (le formulaire actuel en contient plusieurs par jour).
alter table public.session_logs
  add column activity_type_id uuid references public.activity_types(id),
  add column source text not null default 'app' check (source in ('app', 'import_form', 'staff'));

alter table public.profiles add column import_name text unique; -- 'DUPONT Jean' tel qu'écrit dans le formulaire Google

-- ============ VUES DE SUIVI ============

-- Fiche athlète : charge et volumes par pilier, comparés à la cible de la semaine
create view public.weekly_player_load with (security_invoker = true) as
with logs as (
  select sl.player_id, gm.group_id,
         date_trunc('week', sl.session_date)::date as week_start,
         sl.duration_min, sl.srpe, sl.rpe, at.pillar
  from public.session_logs sl
  join public.group_members gm on gm.player_id = sl.player_id
  left join public.activity_types at on at.id = sl.activity_type_id
)
select
  l.player_id, l.group_id, l.week_start,
  sw.code  as week_code, sw.cycle, wt.code as week_type, wt.target_srpe,
  count(*)                                                    as activities,
  sum(l.duration_min)                                         as total_min,
  sum(l.duration_min) filter (where l.pillar = 'rugby')          as rugby_min,
  sum(l.duration_min) filter (where l.pillar = 'physique')       as physique_min,
  sum(l.duration_min) filter (where l.pillar = 'accompagnement') as accompagnement_min,
  sum(l.duration_min) filter (where l.pillar = 'ppid')           as ppid_min,
  sum(l.srpe)                                                 as srpe,
  round(avg(l.rpe), 1)                                        as avg_rpe,
  round(100.0 * sum(l.srpe) / nullif(wt.target_srpe, 0), 1)   as pct_target,
  case
    when wt.target_srpe is null                 then null
    when sum(l.srpe) < 0.85 * wt.target_srpe    then 'sous-charge'
    when sum(l.srpe) > 1.15 * wt.target_srpe    then 'surcharge'
    else 'conforme'
  end                                                         as status
from logs l
left join public.season_weeks sw on sw.group_id = l.group_id and sw.start_date = l.week_start
left join public.week_types  wt on wt.code = sw.week_type_code
group by l.player_id, l.group_id, l.week_start, sw.code, sw.cycle, wt.code, wt.target_srpe;

-- Tableau de bord : moyenne du groupe (pour l'écart « vs moyenne groupe »)
create view public.weekly_group_load with (security_invoker = true) as
select group_id, week_start, week_code, week_type, target_srpe,
       count(*)                 as players,
       round(avg(srpe))         as avg_srpe,
       round(avg(total_min))    as avg_min,
       count(*) filter (where status = 'sous-charge') as under_count,
       count(*) filter (where status = 'surcharge')   as over_count
from public.weekly_player_load
group by group_id, week_start, week_code, week_type, target_srpe;

-- ============ RLS ============

alter table public.activity_types enable row level security;
alter table public.week_types     enable row level security;
alter table public.season_weeks   enable row level security;

create policy "activity_types_read"  on public.activity_types for select using (auth.uid() is not null);
create policy "activity_types_staff" on public.activity_types for all using (public.is_staff()) with check (public.is_staff());
create policy "week_types_read"      on public.week_types     for select using (auth.uid() is not null);
create policy "week_types_staff"     on public.week_types     for all using (public.is_staff()) with check (public.is_staff());
create policy "season_weeks_read"    on public.season_weeks   for select using (auth.uid() is not null);
create policy "season_weeks_staff"   on public.season_weeks   for all using (public.is_staff()) with check (public.is_staff());

-- ============ DONNÉES DE RÉFÉRENCE (issues de CONFIG_SEMAINES_PER / PLANNING_CHARGES) ============

insert into public.week_types values
  ('DEV',  'Semaine Développement', 720, 300, 120, 120, 180, 3000, 2500, null, 'Charge élevée — accent force & vitesse (41 %), PPID (25 %)'),
  ('COMP', 'Semaine Compétition',   720, 180, 240, 120, 180, 2000, 1500, 2500, 'Charge modérée — accent rugby (33 %), vidéo tactique & match'),
  ('REG',  'Semaine Régénération',  420,  60, 120, 120, 120, 1000, null, 1200, 'Décharge active — récupération, kiné & PPID');

insert into public.activity_types (name, pillar, default_duration_min, requires_rpe) values
  ('Dév. Tactique',        'rugby',          30, true),
  ('Musculation',          'physique',       60, true),
  ('Jeu au Poste',         'rugby',          45, true),
  ('Dév. Indiv',           'ppid',           45, true),
  ('Collectif Réduit',     'rugby',          60, true),
  ('Collectif Ligne',      'rugby',          60, true),
  ('Collectif Total',      'rugby',          90, true),
  ('Collectif CRABOS',     'rugby',          60, true),
  ('Vitesse & Puissance',  'physique',       45, true),
  ('Préparation Physique', 'physique',       45, true),
  ('Besoins Spécifiques',  'ppid',           45, true),
  ('Vidéo',                'accompagnement', 25, false),
  ('Vidéo Indiv',          'accompagnement', 30, false),
  ('Kiné & Soins',         'accompagnement', 60, false),
  ('Récupération',         'accompagnement', 60, false);

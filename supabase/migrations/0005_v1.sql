-- Rugby Tracker — règles de la V1 (docs/PLAN.md, étape 1)
-- Import idempotent, wellness sur 25, saisies verrouillées, statut blessé / apte.

-- ============ OUTILS RLS ============

-- « Aujourd'hui » vu de Rouen : current_date est en UTC sur Supabase
create function public.paris_today()
returns date language sql stable as $$
  select (now() at time zone 'Europe/Paris')::date;
$$;

create function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ============ CLÉS UNIQUES (import relançable, pas de doublon de saisie) ============

alter table public.planned_sessions
  add constraint planned_sessions_unique unique nulls not distinct (session_date, group_id, player_id, activity_type_id, title);
alter table public.planned_exercises
  add constraint planned_exercises_unique unique (planned_session_id, position);
alter table public.session_logs
  add constraint session_logs_unique unique (player_id, session_date, activity_type_id), -- une seule muscu par jour
  add constraint session_logs_activity check (source <> 'app' or activity_type_id is not null),
  add column validated_at timestamptz;     -- séance validée : le joueur ne peut plus la modifier

-- Le lien passe déjà par session_logs.planned_session_id
alter table public.exercise_feedback drop column session_log_id;

-- ============ WELLNESS SUR 25 ============

alter table public.wellness_entries drop column score;
alter table public.wellness_entries
  add column score smallint generated always as (sleep_quality + fatigue + soreness + stress + mood) stored; -- 5 à 25

-- ============ SAISIES JOUEUR : modifiables le jour même, tant que la séance n'est pas validée ============

drop policy "logs_own"     on public.session_logs;
drop policy "wellness_own" on public.wellness_entries;
drop policy "feedback_own" on public.exercise_feedback;

create policy "logs_read"  on public.session_logs for select using (player_id = auth.uid() or public.is_staff());
create policy "logs_staff" on public.session_logs for all using (public.is_staff()) with check (public.is_staff());
create policy "logs_player_insert" on public.session_logs for insert with check (
  player_id = auth.uid() and source = 'app' and session_date = public.paris_today()
  and (planned_session_id is null or exists (select 1 from public.planned_sessions ps where ps.id = planned_session_id))
);
create policy "logs_player_update" on public.session_logs for update
  using (player_id = auth.uid() and session_date = public.paris_today() and validated_at is null)
  with check (player_id = auth.uid() and source = 'app' and session_date = public.paris_today()
    and (planned_session_id is null or exists (select 1 from public.planned_sessions ps where ps.id = planned_session_id)));
create policy "logs_player_delete" on public.session_logs for delete
  using (player_id = auth.uid() and session_date = public.paris_today() and validated_at is null);

create policy "wellness_read"  on public.wellness_entries for select using (player_id = auth.uid() or public.is_staff());
create policy "wellness_staff" on public.wellness_entries for all using (public.is_staff()) with check (public.is_staff());
create policy "wellness_player" on public.wellness_entries for all
  using (player_id = auth.uid() and entry_date = public.paris_today())
  with check (player_id = auth.uid() and entry_date = public.paris_today());

-- Exercice visible du joueur (RLS de planned_sessions), séance du jour, pas encore validée
create function public.can_edit_feedback(p_planned_exercise_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from public.planned_exercises pe
    join public.planned_sessions ps on ps.id = pe.planned_session_id
    where pe.id = p_planned_exercise_id
      and ps.session_date = public.paris_today()
      and not exists (select 1 from public.session_logs sl
                      where sl.planned_session_id = ps.id and sl.player_id = auth.uid() and sl.validated_at is not null)
  );
$$;

create policy "feedback_read"   on public.exercise_feedback for select using (player_id = auth.uid() or public.is_staff());
create policy "feedback_staff"  on public.exercise_feedback for all using (public.is_staff()) with check (public.is_staff());
create policy "feedback_player" on public.exercise_feedback for all
  using (player_id = auth.uid() and public.can_edit_feedback(planned_exercise_id))
  with check (player_id = auth.uid() and public.can_edit_feedback(planned_exercise_id));

-- ============ STATUT BLESSÉ / APTE (donnée de santé : écrit par les admins seulement) ============

create type public.availability_status as enum ('apte', 'blessé');

create table public.player_availability (
  player_id  uuid primary key references public.profiles(id) on delete cascade,
  status     public.availability_status not null,
  since      date not null default public.paris_today(),
  note       text,
  updated_by uuid references public.profiles(id) default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.player_availability enable row level security;
create policy "availability_read"  on public.player_availability for select using (player_id = auth.uid() or public.is_staff());
create policy "availability_admin" on public.player_availability for all using (public.is_admin()) with check (public.is_admin());

-- ============ ACTIVITÉS DU JOUEUR BLESSÉ ============

insert into public.activity_types (name, pillar, default_duration_min, requires_rpe) values
  ('Membres sains',   'physique', 45, true),
  ('Réhabilitation',  'physique', 45, true),
  ('Reprise terrain', 'rugby',    45, true);

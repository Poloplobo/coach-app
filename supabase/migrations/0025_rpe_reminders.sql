-- Relance d'un joueur qui n'a pas déclaré sa veille (décision du 03/11/2026) : le staff clique « Relancer », le joueur voit
-- un bandeau à l'accueil et peut déclarer les activités et la séance de muscu d'hier, jusqu'à minuit. Sans relance, la
-- règle reste « le jour même ».
create table public.rpe_reminders (
  player_id    uuid not null references public.profiles(id) on delete cascade,
  missing_date date not null,
  sent_by      uuid references public.profiles(id) default auth.uid(),
  sent_at      timestamptz not null default now(),
  primary key (player_id, missing_date)
);
alter table public.rpe_reminders enable row level security;
create policy "reminders_read"  on public.rpe_reminders for select using (player_id = auth.uid() or public.is_staff());
create policy "reminders_staff" on public.rpe_reminders for all using (public.is_staff()) with check (public.is_staff());

-- Jour que le joueur connecté peut déclarer : aujourd'hui, ou hier s'il a été relancé pour ce jour-là
create function public.can_log_day(p_date date) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_date = public.paris_today()
      or (p_date = public.paris_today() - 1
          and exists (select 1 from public.rpe_reminders r where r.player_id = auth.uid() and r.missing_date = p_date))
$$;

drop policy "logs_player_insert" on public.session_logs;
create policy "logs_player_insert" on public.session_logs for insert with check (
  player_id = auth.uid() and source = 'app' and public.can_log_day(session_date)
  and (planned_session_id is null or exists (select 1 from public.planned_sessions ps where ps.id = planned_session_id)));
drop policy "logs_player_update" on public.session_logs;
create policy "logs_player_update" on public.session_logs for update
  using (player_id = auth.uid() and source = 'app' and public.can_log_day(session_date) and validated_at is null)
  with check (player_id = auth.uid() and source = 'app' and public.can_log_day(session_date)
    and (planned_session_id is null or exists (select 1 from public.planned_sessions ps where ps.id = planned_session_id)));
drop policy "logs_player_delete" on public.session_logs;
create policy "logs_player_delete" on public.session_logs for delete
  using (player_id = auth.uid() and source = 'app' and public.can_log_day(session_date) and validated_at is null);

-- Retours d'exercice : même fenêtre que le RPE (séance du jour, ou d'hier après relance), tant qu'elle n'est pas validée
create or replace function public.can_edit_feedback(p_planned_exercise_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1
    from public.planned_exercises pe
    join public.planned_sessions ps on ps.id = pe.planned_session_id
    where pe.id = p_planned_exercise_id
      and public.can_log_day(ps.session_date)
      and not exists (select 1 from public.session_logs sl
                      where sl.planned_session_id = ps.id and sl.player_id = auth.uid() and sl.validated_at is not null)
  );
$$;

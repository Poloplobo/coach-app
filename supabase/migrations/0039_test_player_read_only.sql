-- Compte de test en lecture seule (décision du 06/11/2026) : il sert à voir l'interface joueur, jamais à écrire dans les
-- données. Politiques restrictives (s'ajoutent aux autres) sur tout ce qu'un joueur peut écrire.
create function public.is_test_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_test from public.profiles where id = auth.uid()), false)
$$;

do $$
declare t text;
begin
  foreach t in array array['session_logs', 'wellness_entries', 'exercise_feedback', 'match_ratings', 'push_subscriptions'] loop
    execute format('create policy "test_no_insert" on public.%I as restrictive for insert to authenticated with check (not public.is_test_user())', t);
    execute format('create policy "test_no_update" on public.%I as restrictive for update to authenticated using (not public.is_test_user())', t);
    execute format('create policy "test_no_delete" on public.%I as restrictive for delete to authenticated using (not public.is_test_user())', t);
  end loop;
end $$;

-- Reprise d'une séance manquée (security definer, hors RLS) : refusée au compte de test
create or replace function public.redo_muscu_session(p_session uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_session public.planned_sessions;
  v_today date := public.paris_today();
begin
  if public.is_test_user() then raise exception 'compte de test : lecture seule' using errcode = '42501'; end if;
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

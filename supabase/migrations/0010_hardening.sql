-- Durcissement avant la mise en ligne (relecture sécurité du 24/10/2026)

-- 1. Profils : seul un admin crée, modifie ou supprime un profil (un coach ne peut plus se donner le rôle admin,
--    ni supprimer un profil, ce qui effacerait en cascade toutes les données du joueur). Le staff garde la lecture.
drop policy "profiles_staff_write" on public.profiles;
create policy "profiles_admin_write" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- 2. Fonctions appelées par la RLS : search_path fixé (les noms sont déjà préfixés par public.)
alter function public.paris_today() set search_path = '';
alter function public.can_edit_feedback(uuid) set search_path = '';

-- 3. Un joueur ne reprend que ses propres saisies de l'app, jamais une ligne importée ou corrigée par le staff
drop policy "logs_player_update" on public.session_logs;
create policy "logs_player_update" on public.session_logs for update
  using (player_id = auth.uid() and source = 'app' and session_date = public.paris_today() and validated_at is null)
  with check (player_id = auth.uid() and source = 'app' and session_date = public.paris_today()
    and (planned_session_id is null or exists (select 1 from public.planned_sessions ps where ps.id = planned_session_id)));
drop policy "logs_player_delete" on public.session_logs;
create policy "logs_player_delete" on public.session_logs for delete
  using (player_id = auth.uid() and source = 'app' and session_date = public.paris_today() and validated_at is null);

-- 4. L'app exige une connexion : aucun droit pour les visiteurs non connectés (anon), même si la RLS bloquait déjà tout
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
alter default privileges in schema public grant execute on functions to authenticated;

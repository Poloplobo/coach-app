-- Séance de musculation manquée (décision du 06/11/2026) : le joueur la reprend un autre jour de la même semaine. Elle est
-- déplacée à aujourd'hui (une seule séance de muscu par jour) ; ses retours d'exercice non validés sont effacés pour
-- repartir de zéro. Le planning reste écrit par le staff : cette fonction est le seul geste ouvert au joueur, et seulement
-- sur sa propre séance, d'un jour passé de la semaine en cours, non validée.
create function public.redo_muscu_session(p_session uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_session public.planned_sessions;
  v_type uuid;
  v_today date := public.paris_today();
begin
  select id into v_type from public.activity_types where name = 'Musculation';
  select * into v_session from public.planned_sessions
  where id = p_session and player_id = auth.uid() and activity_type_id = v_type
  for update;
  if v_session.id is null then raise exception 'séance introuvable' using errcode = 'P0002'; end if;
  if v_session.session_date >= v_today or date_trunc('week', v_session.session_date) <> date_trunc('week', v_today) then
    raise exception 'seule une séance d''un jour passé de cette semaine peut être reprise' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.session_logs where planned_session_id = v_session.id and validated_at is not null) then
    raise exception 'séance déjà validée' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.planned_sessions where player_id = auth.uid() and activity_type_id = v_type and session_date = v_today)
     or exists (select 1 from public.session_logs where player_id = auth.uid() and activity_type_id = v_type and session_date = v_today) then
    raise exception 'tu as déjà une séance de musculation aujourd''hui' using errcode = 'P0001';
  end if;
  delete from public.exercise_feedback f using public.planned_exercises pe
  where pe.id = f.planned_exercise_id and pe.planned_session_id = v_session.id and f.player_id = auth.uid();
  update public.planned_sessions set session_date = v_today where id = v_session.id;
end $$;
revoke execute on function public.redo_muscu_session(uuid) from public, anon;

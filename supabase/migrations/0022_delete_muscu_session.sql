-- Supprimer une séance de musculation à venir (erreur d'import, séance annulée). Jamais de perte de données du joueur :
-- refusé si le jour est passé, si un exercice a un retour du joueur ou si le RPE de la séance est déclaré.
-- security invoker : la RLS s'applique (écritures réservées au staff) ; exercices supprimés en cascade.
create function public.delete_muscu_session(p_session uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_date date;
begin
  if not public.is_staff() then raise exception 'réservé au staff' using errcode = '42501'; end if;
  select ps.session_date into v_date from public.planned_sessions ps
  join public.activity_types a on a.id = ps.activity_type_id and a.name = 'Musculation'
  where ps.id = p_session and ps.player_id is not null
  for update;
  if v_date is null then raise exception 'séance de musculation introuvable' using errcode = 'P0002'; end if;
  if v_date < public.paris_today() then raise exception 'séance passée : l''historique ne se supprime pas' using errcode = 'P0001'; end if;
  if exists (select 1 from public.planned_exercises pe join public.exercise_feedback f on f.planned_exercise_id = pe.id
             where pe.planned_session_id = p_session)
     or exists (select 1 from public.session_logs sl where sl.planned_session_id = p_session) then
    raise exception 'le joueur a déjà répondu à cette séance : elle ne se supprime pas' using errcode = 'P0001';
  end if;
  delete from public.planned_sessions where id = p_session;
end $$;

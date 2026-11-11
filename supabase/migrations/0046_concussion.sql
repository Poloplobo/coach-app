-- Commotion cérébrale (décision du 11/11/2026) : déclarée en un geste dans Médical. Le joueur passe blessé, sa fiche et son
-- plan suivent les règles FFR secteur amateur (data/Commotions) selon l'âge et le rang de la commotion sur 12 mois :
--   moins de 18 ans : contact au plus tôt J23 (1re), J42 (2e, avis spécialisé), J180 (3e, spécialiste) ; 1 semaine de repos
--   18 ans et plus  : J10 (1re, 48 h de repos), J22 (2e), J91 (3e, spécialiste)
-- Paliers du protocole de retour au jeu (PRJ) : 1 repos, 2 aérobie léger, 3 spécifique, 4 sans contact, avis médical,
-- 5 contact, 6 compétition. Les durées intermédiaires sont indicatives ; les dates « pas avant » sont celles de la FFR.
alter table public.injuries add column concussion_rank smallint check (concussion_rank between 1 and 3);

create function public.declare_concussion(p_player uuid, p_occurred_on date, p_minor boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_rank int;
  v_injury uuid;
  v_rest int;          -- jours de repos complet (palier 1), J0 compris
  v_contact int;       -- premier jour possible du contact (palier 5)
  v_prj int;           -- durée indicative des paliers 2 à 4
  v_review int;        -- attente jusqu'au contact, avis médical compris
  v_specialist boolean;
  v_sym constant text := 'Aucun symptôme pendant et après le palier. S''ils réapparaissent : arrêter le palier en cours, nouvel essai 24 h après.';
  d text;
begin
  if not public.is_staff() then raise exception 'réservé au staff' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_player and role = 'player' and not is_test) then
    raise exception 'joueur introuvable' using errcode = 'P0002';
  end if;
  if p_occurred_on is null or p_occurred_on > public.paris_today() or p_occurred_on < public.paris_today() - 30 then
    raise exception 'date de la commotion invalide (dans les 30 derniers jours)' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.injuries where player_id = p_player and ended_on is null and concussion_rank is not null) then
    raise exception 'une commotion est déjà en cours pour ce joueur' using errcode = 'P0001';
  end if;

  select least(3, 1 + count(*)) into v_rank from public.injuries
  where player_id = p_player and concussion_rank is not null and occurred_on > p_occurred_on - 365;
  v_contact := case when p_minor then (array[23, 42, 180])[v_rank] else (array[10, 22, 91])[v_rank] end;
  v_rest := case when not p_minor and v_rank = 1 then 3 else 8 end;
  v_specialist := v_rank = 3 or (p_minor and v_rank = 2);
  v_prj := least(3, greatest(1, (v_contact - v_rest - 1) / 4));
  v_review := v_contact - v_rest - 3 * v_prj;

  insert into public.injuries (player_id, occurred_on, location, tissue, onset, recurrence, diagnosis, concussion_rank, alerts)
  values (p_player, p_occurred_on, 'tete', 'nerveux', 'soudaine', v_rank > 1,
          format('Commotion cérébrale (%s dans les 12 derniers mois) · protocole FFR %s', (array['1re', '2e', '3e'])[v_rank],
                 case when p_minor then 'moins de 18 ans' else '18 ans et plus' end),
          v_rank, public.injury_alerts(p_player, p_occurred_on))
  returning id into v_injury;

  d := to_char(p_occurred_on + v_contact, 'DD/MM/YYYY');
  insert into public.injury_steps (injury_id, player_id, position, phase, phase_days, title, planned_days, objectives, prepa_actions,
                                   criteria, comment, is_test) values
    (v_injury, p_player, 1, 'Protocole commotion · repos', v_rest, 'Palier 1 · Repos complet', v_rest,
     'Repos physique complet : aucun sport, aucun entraînement.', null,
     format('Plus aucun symptôme de commotion pour passer au palier 2, au plus tôt à J%s (le %s).', v_rest, to_char(p_occurred_on + v_rest, 'DD/MM/YYYY')),
     'Informer le joueur et sa famille : consulter immédiatement un médecin ou les urgences si les symptômes s''aggravent. '
       || 'Symptômes au-delà de 10 jours : avis médical.', false),
    (v_injury, p_player, 2, 'Reprise sans contact (PRJ)', 3 * v_prj, 'Palier 2 · Activité aérobie légère', v_prj,
     'Marche, vélo d''appartement, intensité faible.', 'Pas de musculation ni de course intense.', v_sym, null, false),
    (v_injury, p_player, 3, 'Reprise sans contact (PRJ)', 3 * v_prj, 'Palier 3 · Exercices spécifiques', v_prj,
     'Course et exercices de course, sans risque de choc à la tête.', null, v_sym, null, false),
    (v_injury, p_player, 4, 'Reprise sans contact (PRJ)', 3 * v_prj, 'Palier 4 · Entraînement sans contact', v_prj,
     'Exercices d''entraînement plus complexes, sans contact ; reprise progressive de la musculation.', null, v_sym, null, false),
    (v_injury, p_player, 5, 'Avis médical', v_review,
     case when v_specialist then 'Avis d''un médecin spécialiste en commotion : certificat' else 'Avis médical : certificat de non contre-indication' end,
     v_review,
     'Le médecin vérifie la disparition des symptômes, leur absence à l''effort pendant les paliers et un examen normal.', null,
     'Certificat de non contre-indication à la reprise du rugby en compétition, remis au staff et à la commission médicale de la Ligue (déblocage de la licence).',
     case when v_rank = 3 and p_minor then 'Durée laissée à l''appréciation du spécialiste (180 jours minimum).' end, true),
    (v_injury, p_player, 6, 'Retour au rugby', 2, 'Palier 5 · Entraînement avec contact', 2,
     'Entraînement complet avec contact.', null, format('Pas avant J%s (le %s) et seulement avec le certificat.', v_contact, d), null, false),
    (v_injury, p_player, 7, 'Retour au rugby', 2, 'Palier 6 · Retour en compétition', 0,
     'Retour en match.', null, 'Licence débloquée par la commission médicale de la Ligue.', null, false);

  -- Le joueur passe blessé : sa fiche existe déjà, le déclencheur ne crée pas de plan par défaut
  insert into public.player_availability (player_id, status, since, note)
  values (p_player, 'blessé', p_occurred_on, 'Commotion cérébrale (protocole FFR)')
  on conflict (player_id) do update set status = 'blessé', since = excluded.since, note = excluded.note;

  return jsonb_build_object('injury', v_injury, 'rank', v_rank, 'contact_day', v_contact, 'contact_on', p_occurred_on + v_contact,
                            'specialist', v_specialist);
end $$;
revoke execute on function public.declare_concussion(uuid, date, boolean) from public, anon;
grant execute on function public.declare_concussion(uuid, date, boolean) to authenticated;

-- Plan du joueur : seulement sa blessure en cours la plus récente (une commotion pendant une autre blessure ne mélange pas les étapes)
create or replace function public.my_return_plan() returns table (occurred_on date, id uuid, step int, title text, criteria text, planned_days int,
  validated_on date, phase text, phase_days int, objectives text, prepa_actions text, is_test boolean, in_progress boolean)
language sql stable security definer set search_path = '' as $$
  select i.occurred_on, s.id, s.position, s.title, s.criteria, s.planned_days, s.validated_on, s.phase, s.phase_days, s.objectives,
         s.prepa_actions, s.is_test, s.in_progress
  from public.injuries i join public.injury_steps s on s.injury_id = i.id
  where i.id = (select x.id from public.injuries x where x.player_id = auth.uid() and x.ended_on is null
                order by x.occurred_on desc, x.created_at desc limit 1)
  order by s.position
$$;

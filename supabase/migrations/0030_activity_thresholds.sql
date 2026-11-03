-- Seuil de charge par activité (décision du 03/11/2026) : au-dessus de max_srpe UA sur une séance, l'activité est
-- signalée au staff (orange ; rouge au-delà de 1,25 × le seuil). Réglé par le staff (Programmation), nul : pas d'alerte.
alter table public.activity_types add column max_srpe integer check (max_srpe is null or max_srpe > 0);

-- Pré-rempli avec le repère de la saison : 90 % des séances de l'activité sont en dessous (arrondi à la dizaine),
-- pour les activités avec RPE et au moins 5 séances déclarées
update public.activity_types a set max_srpe = s.p90
from (select activity_type_id, (round(percentile_cont(0.9) within group (order by srpe) / 10) * 10)::int as p90
      from public.session_logs where srpe > 0 and activity_type_id is not null
      group by activity_type_id having count(*) >= 5) s
where s.activity_type_id = a.id and a.requires_rpe;

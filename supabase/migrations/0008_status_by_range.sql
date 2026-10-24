-- Statut hebdo selon la plage du type de semaine (REG 500-1500, COMP 1500-2500, DEV > 2500) au lieu de ±15 % de la cible.
-- pct_target reste la précision affichée à côté du statut.
create or replace view public.weekly_player_load with (security_invoker = true) as
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
    when wt.code is null                    then null
    when sum(l.srpe) < wt.srpe_min          then 'sous-charge'
    when sum(l.srpe) > wt.srpe_max          then 'surcharge'   -- DEV : pas de maximum
    else 'conforme'
  end                                                         as status
from logs l
join public.season_weeks sw on sw.group_id = l.group_id and sw.start_date = l.week_start
left join public.week_types  wt on wt.code = sw.week_type_code
group by l.player_id, l.group_id, l.week_start, sw.code, sw.cycle, wt.code, wt.target_srpe, wt.srpe_min, wt.srpe_max;

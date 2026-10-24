-- Rugby Tracker — corrections issues de la relecture du schéma

-- ============ DOUBLONS SUPPRIMÉS ============

drop view public.weekly_load;                              -- remplacée par weekly_player_load
alter table public.profiles drop column height_cm, drop column weight_kg; -- historisés dans body_measurements
alter table public.planned_exercises drop column load_pct; -- remplacé par load_value + load_unit = 'pct_rm'
drop table public.set_logs;                                -- la V1 saisit une charge par exercice : exercise_feedback

-- ============ WELLNESS : score de 0 à 100 ============
-- (5 items notés 1 à 5 : tout à 1 = 0, tout à 5 = 100)

alter table public.wellness_entries drop column score;
alter table public.wellness_entries
  add column score numeric generated always as ((sleep_quality + fatigue + soreness + stress + mood - 5) * 5) stored;

-- ============ CHARGE HEBDO : une séance n'est comptée que pour le groupe dont le calendrier couvre la semaine ============
-- Sans ça, un joueur inscrit dans « Crabos 25/26 » et « Crabos 26/27 » voyait chaque séance comptée dans les deux groupes.

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
    when wt.target_srpe is null                 then null
    when sum(l.srpe) < 0.85 * wt.target_srpe    then 'sous-charge'
    when sum(l.srpe) > 1.15 * wt.target_srpe    then 'surcharge'
    else 'conforme'
  end                                                         as status
from logs l
join public.season_weeks sw on sw.group_id = l.group_id and sw.start_date = l.week_start
left join public.week_types  wt on wt.code = sw.week_type_code
group by l.player_id, l.group_id, l.week_start, sw.code, sw.cycle, wt.code, wt.target_srpe;

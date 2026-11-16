-- Blocs de la saison (résumés bloc / cycle / coach) : chaque semaine porte le numéro de son bloc, modifiable par le staff
-- (Programmation › Semaines). Le cycle reste season_weeks.cycle ; le rang du bloc dans son cycle se déduit à l'écran.
alter table public.season_weeks add column block smallint check (block between 1 and 99);

-- Préremplissage (décision du 16/11/2026) : un bloc se ferme après chaque semaine de Régénération, ou au changement de cycle
with flagged as (
  select id, group_id, start_date,
    case when lag(week_type_code) over w = 'REG' or lag(cycle) over w is distinct from cycle then 1 else 0 end as starts,
    row_number() over w as rank
  from public.season_weeks
  window w as (partition by group_id order by start_date)
), numbered as (
  -- la première semaine ouvre toujours le bloc 1 (son « changement de cycle » ne compte pas)
  select id, 1 + sum(case when rank = 1 then 0 else starts end) over (partition by group_id order by start_date) as block
  from flagged
)
update public.season_weeks s set block = n.block from numbered n where n.id = s.id;

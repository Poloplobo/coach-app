-- Bibliothèque d'exercices : un nom ne peut exister qu'une fois, quelle que soit la casse (« Superman » = « SuperMan »).
-- Les doublons venus des fiches sont fusionnés : on garde l'orthographe la plus utilisée et on y rattache les séances.
create temporary table exercise_merge on commit drop as
select e.id, lower(trim(e.name)) as k,
       row_number() over (
         partition by lower(trim(e.name))
         order by (select count(*) from public.planned_exercises pe where pe.exercise_id = e.id) desc, e.name
       ) as rn
from public.exercises e;

update public.planned_exercises pe
set exercise_id = keep.id
from exercise_merge dup
join exercise_merge keep on keep.k = dup.k and keep.rn = 1
where dup.rn > 1 and pe.exercise_id = dup.id;

delete from public.exercises where id in (select id from exercise_merge where rn > 1);

create unique index exercises_name_ci on public.exercises (lower(trim(name)));

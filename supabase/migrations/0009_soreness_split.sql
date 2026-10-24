-- État de forme : les courbatures sont notées séparément pour le haut et le bas du corps (6 questions, score sur 30).
-- Les anciennes lignes n'ont que « soreness » : elle compte pour les deux, ce qui garde un score sur 30 comparable.

alter table public.wellness_entries
  add column soreness_upper smallint check (soreness_upper between 1 and 5),
  add column soreness_lower smallint check (soreness_lower between 1 and 5),
  alter column soreness drop not null,
  add constraint wellness_soreness check (soreness is not null or (soreness_upper is not null and soreness_lower is not null));

alter table public.wellness_entries drop column score;
alter table public.wellness_entries add column score smallint generated always as (
  sleep_quality + fatigue + stress + mood + coalesce(soreness_upper, soreness) + coalesce(soreness_lower, soreness)
) stored; -- 6 à 30

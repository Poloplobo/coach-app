-- RPE visé (décision du 04/11/2026) : chaque type de semaine (DEV, COMP, REG) a un RPE visé par activité ; une séance
-- du planning peut avoir le sien (planned_sessions.planned_rpe, existant), sinon elle prend celui de son type de semaine.
-- Le staff compare le RPE déclaré à ce RPE visé (écart signalé à ±2).
create table public.week_type_rpe (
  week_type_code   text not null references public.week_types(code) on delete cascade,
  activity_type_id uuid not null references public.activity_types(id) on delete cascade,
  target_rpe       numeric(3,1) not null check (target_rpe between 0 and 10),
  primary key (week_type_code, activity_type_id)
);
alter table public.week_type_rpe enable row level security;
create policy "week_type_rpe_read"  on public.week_type_rpe for select using (auth.uid() is not null);
create policy "week_type_rpe_staff" on public.week_type_rpe for all using (public.is_staff()) with check (public.is_staff());

-- Proposition (modifiable dans Programmation) : RPE moyen déclaré dans la saison par type de semaine, multiplié pour que la
-- semaine type, avec les minutes réelles moyennes d'un joueur, atteigne la charge visée (DEV × 1,39 → 3000 UA ;
-- COMP × 1,14 → 2000 UA) ; REG (pas encore de semaine jouée) : COMP × 0,86 (moitié de la charge, ~60 % du volume).
-- Collectif Total, peu déclaré sous ce nom, reprend Collectif CRABOS. Arrondi au demi-point.
insert into public.week_type_rpe (week_type_code, activity_type_id, target_rpe)
select v.week_type, a.id, v.rpe
from (values
  ('DEV', 'Musculation', 8.0), ('DEV', 'Collectif CRABOS', 7.0), ('DEV', 'Collectif Total', 7.0), ('DEV', 'Jeu au Poste', 5.0),
  ('DEV', 'Collectif Réduit', 8.0), ('DEV', 'Collectif Ligne', 6.0), ('DEV', 'Dév. Tactique', 4.5), ('DEV', 'Dév. Indiv', 5.5),
  ('DEV', 'Vitesse & Puissance', 5.5), ('DEV', 'Membres sains', 3.0),
  ('COMP', 'Musculation', 6.5), ('COMP', 'Collectif CRABOS', 5.5), ('COMP', 'Collectif Total', 5.5), ('COMP', 'Jeu au Poste', 4.0),
  ('COMP', 'Collectif Ligne', 5.0), ('COMP', 'Collectif Réduit', 4.0), ('COMP', 'Dév. Tactique', 3.0), ('COMP', 'Dév. Indiv', 2.5),
  ('COMP', 'Vitesse & Puissance', 4.5), ('COMP', 'Membres sains', 2.5),
  ('REG', 'Musculation', 5.5), ('REG', 'Collectif CRABOS', 4.5), ('REG', 'Collectif Total', 4.5), ('REG', 'Jeu au Poste', 3.5),
  ('REG', 'Collectif Ligne', 4.5), ('REG', 'Collectif Réduit', 3.5), ('REG', 'Dév. Tactique', 2.5), ('REG', 'Dév. Indiv', 2.0),
  ('REG', 'Vitesse & Puissance', 4.0), ('REG', 'Membres sains', 2.0)
) as v(week_type, name, rpe)
join public.activity_types a on a.name = v.name and a.requires_rpe
join public.week_types w on w.code = v.week_type
on conflict do nothing;

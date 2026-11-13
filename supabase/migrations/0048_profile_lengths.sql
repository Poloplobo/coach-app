-- Limites de longueur (break-ui du 13/11/2026) : sans elles, un nom ou un poste importé de 300 caractères casserait les
-- tableaux. Plus longs actuels en prod : prénom 8, nom 14, poste 10 caractères ; marge large.
alter table public.profiles
  add constraint profiles_first_name_length check (length(first_name) <= 60),
  add constraint profiles_last_name_length check (length(last_name) <= 60),
  add constraint profiles_position_length check (position is null or length(position) <= 40);

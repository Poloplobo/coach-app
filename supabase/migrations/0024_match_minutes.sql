-- Espace Match (décision du 03/11/2026) : le coach saisit le temps de jeu de chaque joueur avec sa note. Porté par la
-- ligne staff seulement : le joueur ne le saisit pas, et ne le voit qu'avec la note du coach (RLS de match_ratings).
alter table public.match_ratings add column minutes smallint check (minutes between 0 and 120);
alter table public.match_ratings add constraint match_ratings_minutes_staff check (rater = 'staff' or minutes is null);

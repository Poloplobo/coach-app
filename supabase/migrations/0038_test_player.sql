-- Compte de test (décision du 06/11/2026) : un joueur « test » permanent pour vérifier l'interface joueur à chaque
-- déploiement. Membre du groupe (il voit le planning comme un joueur), mais jamais dans l'effectif ni dans les chiffres
-- du staff (l'app filtre is_test).
alter table public.profiles add column is_test boolean not null default false;

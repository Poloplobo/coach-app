-- Auto-évaluation du match (décision du 09/11/2026) : le joueur justifie sa note par un commentaire (au moins 10 caractères).
-- Sauf « gris » (n'a pas joué). NOT VALID : les notes déjà données sans commentaire restent telles quelles.
alter table public.match_ratings add constraint match_ratings_player_comment
  check (rater <> 'player' or color = 'gris' or length(trim(coalesce(comment, ''))) >= 10) not valid;
alter table public.match_ratings add constraint match_ratings_comment_length check (length(comment) <= 500) not valid;

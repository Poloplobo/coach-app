-- Consignes du coach pour guider la note de match du joueur : une phrase par couleur de coq, affichée sous chaque coq
-- pour tous les matchs (facultative : sans phrase, seul le libellé de la couleur s'affiche). Lue par tous les connectés,
-- écrite par le staff.
create table public.rating_guidelines (
  color      text primary key check (color in ('rouge', 'jaune', 'vert', 'bleu', 'gris')),
  guideline  text not null check (length(trim(guideline)) between 1 and 300),
  updated_by uuid references public.profiles(id) default auth.uid(),
  updated_at timestamptz not null default now()
);
alter table public.rating_guidelines enable row level security;
create policy "guidelines_read"  on public.rating_guidelines for select using (auth.uid() is not null);
create policy "guidelines_staff" on public.rating_guidelines for all using (public.is_staff()) with check (public.is_staff());

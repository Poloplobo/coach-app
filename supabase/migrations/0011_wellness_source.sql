-- État de forme : provenance de la saisie, comme pour les RPE (le staff peut corriger un oubli ou une erreur)
alter table public.wellness_entries
  add column source text not null default 'app' check (source in ('app', 'staff'));

-- Le joueur ne saisit que pour lui, le jour même, en « app » ; il ne reprend pas une correction faite par le staff
drop policy "wellness_player" on public.wellness_entries;
create policy "wellness_player" on public.wellness_entries for all
  using (player_id = auth.uid() and entry_date = public.paris_today() and source = 'app')
  with check (player_id = auth.uid() and entry_date = public.paris_today() and source = 'app');

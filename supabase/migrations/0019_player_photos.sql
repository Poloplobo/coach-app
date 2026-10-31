-- Étape 11g : photos des joueurs (mineurs) pour les PowerPoint individuels. Jamais dans public/ (servi sans connexion) :
-- un bucket Storage privé, une photo par joueur nommée « <id du joueur>.png », lue et écrite par le staff seulement.
-- Le droit à l'image est de la responsabilité du club (validé par l'utilisateur le 31/10/2026).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-photos', 'player-photos', false, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "player_photos_staff_read" on storage.objects for select to authenticated
  using (bucket_id = 'player-photos' and public.is_staff());
create policy "player_photos_staff_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'player-photos' and public.is_staff());
create policy "player_photos_staff_update" on storage.objects for update to authenticated
  using (bucket_id = 'player-photos' and public.is_staff()) with check (bucket_id = 'player-photos' and public.is_staff());
create policy "player_photos_staff_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'player-photos' and public.is_staff());

-- Photo du joueur dans son app (décision du 10/11/2026) : chaque joueur lit SA photo (« <son id>.png »), jamais celle des
-- autres ; le staff garde la lecture et l'écriture de toutes (0019).
create policy "player_photos_own_read" on storage.objects for select to authenticated
  using (bucket_id = 'player-photos' and name = auth.uid()::text || '.png');

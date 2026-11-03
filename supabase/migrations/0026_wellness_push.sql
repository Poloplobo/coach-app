-- Rappel du matin (décision du 03/11/2026) : notification à 8h00 (heure de Paris) à tous les joueurs abonnés, puis à 10h00
-- à ceux qui n'ont pas encore rempli leur état de forme. Le joueur s'abonne lui-même (Réglages) ; le staff voit seulement
-- qui a activé le rappel. La base choisit les destinataires et les transmet à /api/wellness-reminder (Vercel), qui envoie :
-- Vercel n'a aucun accès à la base. Adresse et secret d'envoi dans Vault (absents en dev : rien n'est envoyé).
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Adresse d'abonnement fournie par le navigateur : seulement les services de notification connus (le serveur d'envoi
-- n'appelle jamais une autre adresse)
create table public.push_subscriptions (
  endpoint   text primary key check (endpoint ~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)/'),
  player_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  p256dh     text not null check (length(p256dh) between 20 and 200),
  auth       text not null check (length(auth) between 8 and 100),
  created_at timestamptz not null default now()
);
create index on public.push_subscriptions (player_id);
alter table public.push_subscriptions enable row level security;
create policy "push_own" on public.push_subscriptions for all using (player_id = auth.uid()) with check (player_id = auth.uid());

-- Staff : qui a activé le rappel (jamais les adresses ni les clés d'abonnement)
create function public.push_enabled_players() returns setof uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'réservé au staff' using errcode = '42501'; end if;
  return query select distinct s.player_id from public.push_subscriptions s;
end $$;

create function public.send_wellness_reminders() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_hour int := extract(hour from now() at time zone 'Europe/Paris');
  v_url text;
  v_secret text;
  v_subs jsonb;
begin
  if v_hour not in (8, 10) then return 0; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_secret';
  if v_url is null or v_secret is null then return 0; end if;
  -- Abonnements refusés par le service de notification lors des derniers envois (téléphone changé, rappel coupé)
  delete from public.push_subscriptions where endpoint in (
    select jsonb_array_elements_text(r.content::jsonb -> 'gone') from net._http_response r
    where r.created > now() - interval '2 days' and r.status_code = 200 and r.content_type like 'application/json%');
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth))), '[]'::jsonb)
  into v_subs
  from public.push_subscriptions s
  join public.profiles p on p.id = s.player_id and p.role = 'player'
  where v_hour = 8
     or not exists (select 1 from public.wellness_entries w where w.player_id = s.player_id and w.entry_date = public.paris_today());
  if jsonb_array_length(v_subs) = 0 then return 0; end if;
  perform net.http_post(url := v_url,
    body := jsonb_build_object('kind', case when v_hour = 8 then 'morning' else 'late' end, 'subscriptions', v_subs),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 20000);
  return jsonb_array_length(v_subs);
end $$;
revoke execute on function public.send_wellness_reminders() from public, authenticated;

-- Toutes les heures de 6h à 9h UTC : 8h et 10h à Paris tombent dedans en hiver (UTC+1) comme en été (UTC+2)
select cron.schedule('wellness-reminders', '0 6-9 * * *', 'select public.send_wellness_reminders()');

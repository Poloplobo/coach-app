-- Rappel du matin, après relecture (03/11/2026) :
-- - au plus 5 téléphones par joueur, envoi par paquets de 100 : un abonnement défectueux ne prive pas tout le groupe ;
-- - le nettoyage des abonnements expirés ne peut plus interrompre l'envoi ;
-- - ni rappel aux joueurs blessés ou inactifs, ni à ceux qui ont déjà rempli (même à 8h).
create function public.limit_push_subscriptions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.push_subscriptions where player_id = new.player_id) >= 5 then
    raise exception 'trop de téléphones abonnés (5 au plus)' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger push_subscriptions_limit before insert on public.push_subscriptions
  for each row execute function public.limit_push_subscriptions();

create or replace function public.send_wellness_reminders() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_hour int := extract(hour from now() at time zone 'Europe/Paris');
  v_url text;
  v_secret text;
  v_subs jsonb;
  v_total int := 0;
begin
  if v_hour not in (8, 10) then return 0; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_secret';
  if v_url is null or v_secret is null then return 0; end if;
  -- Abonnements refusés lors des derniers envois (téléphone changé, rappel coupé). Une réponse illisible ne bloque rien.
  -- shortcut: pg_net garde ses réponses ~6 h ; un abonnement refusé à 10h n'est retiré que s'il l'est encore le lendemain
  begin
    delete from public.push_subscriptions where endpoint in (
      select jsonb_array_elements_text(r.content::jsonb -> 'gone') from net._http_response r
      where r.created > now() - interval '1 day' and r.status_code = 200 and r.content_type like 'application/json%'
        and r.content like '{"sent":%');
  exception when others then null;
  end;
  for v_subs in
    select jsonb_agg(jsonb_build_object('endpoint', t.endpoint, 'keys', jsonb_build_object('p256dh', t.p256dh, 'auth', t.auth)))
    from (
      select s.endpoint, s.p256dh, s.auth, (row_number() over (order by s.endpoint) - 1) / 100 as batch
      from public.push_subscriptions s
      join public.profiles p on p.id = s.player_id and p.role = 'player' and p.is_active
      left join public.player_availability a on a.player_id = s.player_id
      where coalesce(a.status::text, 'apte') <> 'blessé'
        and not exists (select 1 from public.wellness_entries w where w.player_id = s.player_id and w.entry_date = public.paris_today())
    ) t group by t.batch
  loop
    perform net.http_post(url := v_url,
      body := jsonb_build_object('kind', case when v_hour = 8 then 'morning' else 'late' end, 'subscriptions', v_subs),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
      timeout_milliseconds := 20000);
    v_total := v_total + jsonb_array_length(v_subs);
  end loop;
  return v_total;
end $$;
revoke execute on function public.send_wellness_reminders() from public, authenticated;
revoke execute on function public.limit_push_subscriptions() from public, authenticated;

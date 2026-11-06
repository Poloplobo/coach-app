-- Rappel du soir (décision du 06/11/2026) : à 20h (heure de Paris), notification aux joueurs abonnés qui ont un
-- entraînement prévu ce jour-là sans RPE déclaré (activité prévue avec RPE sans déclaration, ou séance individuelle à
-- exercices non validée). Même circuit que le rappel du matin (0026, 0027) : la base choisit, /api/wellness-reminder envoie.
create function public.send_rpe_reminders() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := public.paris_today();
  v_url text;
  v_secret text;
  v_subs jsonb;
  v_total int := 0;
begin
  if extract(hour from now() at time zone 'Europe/Paris') <> 20 then return 0; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_secret';
  if v_url is null or v_secret is null then return 0; end if;
  for v_subs in
    select jsonb_agg(jsonb_build_object('endpoint', t.endpoint, 'keys', jsonb_build_object('p256dh', t.p256dh, 'auth', t.auth)))
    from (
      select s.endpoint, s.p256dh, s.auth, (row_number() over (order by s.endpoint) - 1) / 100 as batch
      from public.push_subscriptions s
      join public.profiles p on p.id = s.player_id and p.role = 'player' and p.is_active
      left join public.player_availability av on av.player_id = s.player_id
      where exists (
        select 1 from public.planned_sessions ps
        join public.activity_types a on a.id = ps.activity_type_id and a.requires_rpe
        where ps.session_date = v_today
          and (ps.player_id = s.player_id or (ps.player_id is null and coalesce(av.status::text, 'apte') <> 'blessé'))
          and not exists (
            select 1 from public.session_logs l
            where l.player_id = s.player_id and l.session_date = v_today and l.activity_type_id = ps.activity_type_id
              and (ps.player_id is null or a.name not in ('Musculation', 'Réhabilitation', 'Membres sains') or l.validated_at is not null)))
    ) t group by t.batch
  loop
    perform net.http_post(url := v_url,
      body := jsonb_build_object('kind', 'rpe', 'subscriptions', v_subs),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
      timeout_milliseconds := 20000);
    v_total := v_total + jsonb_array_length(v_subs);
  end loop;
  return v_total;
end $$;
revoke execute on function public.send_rpe_reminders() from public, authenticated;

-- 20h à Paris = 19h UTC en hiver, 18h UTC en été : les deux passages, seul celui de 20h agit
select cron.schedule('rpe-evening-reminders', '0 18,19 * * *', 'select public.send_rpe_reminders()');

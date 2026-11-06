-- Module médical, après relecture (06/11/2026)
-- 1. Une étape de plan appartient forcément au joueur de sa blessure (sinon un autre joueur pourrait la lire)
alter table public.injuries add constraint injuries_id_player unique (id, player_id);
alter table public.injury_steps add constraint injury_steps_same_player
  foreign key (injury_id, player_id) references public.injuries(id, player_id) on delete cascade;

-- 2. Date de survenue corrigée par le staff (la déclaration arrive souvent après la blessure) : alertes recalculées
create function public.injury_realert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.alerts := public.injury_alerts(new.player_id, new.occurred_on);
  return new;
end $$;
create trigger injuries_realert before update of occurred_on on public.injuries
  for each row when (new.occurred_on is distinct from old.occurred_on) execute function public.injury_realert();

-- 3. Qui a validé une étape
create function public.injury_step_validator() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.validated_by := case when new.validated_on is null then null else auth.uid() end;
  return new;
end $$;
create trigger injury_steps_validator before insert or update of validated_on on public.injury_steps
  for each row execute function public.injury_step_validator();

revoke execute on function public.on_availability_change() from public, authenticated;
revoke execute on function public.injury_realert() from public, authenticated;
revoke execute on function public.injury_step_validator() from public, authenticated;

-- 4. Rappel de 20h : séances de groupe des seuls groupes du joueur
create or replace function public.send_rpe_reminders() returns integer
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
          and (ps.player_id = s.player_id or (ps.player_id is null and coalesce(av.status::text, 'apte') <> 'blessé'
               and ps.group_id in (select gm.group_id from public.group_members gm where gm.player_id = s.player_id)))
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

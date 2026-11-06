-- « Je n'ai pas fait » (décision du 06/11/2026) : le joueur dit qu'il n'a pas fait une activité prévue, avec une raison.
-- Ce n'est plus un oubli de RPE ; le staff voit la liste à part. Aucune charge : rien dans session_logs.
create table public.session_skips (
  id               uuid primary key default gen_random_uuid(),
  player_id        uuid not null references public.profiles (id) on delete cascade,
  session_date     date not null,
  activity_type_id uuid not null references public.activity_types (id),
  reason           text not null check (reason in ('malade', 'absent', 'annulee', 'autre')),
  note             text check (length(note) <= 200),
  created_at       timestamptz not null default now(),
  unique (player_id, session_date, activity_type_id),
  check (reason <> 'autre' or length(trim(coalesce(note, ''))) > 0)
);
alter table public.session_skips enable row level security;

create policy "skips_staff_read" on public.session_skips for select using (public.is_staff());
create policy "skips_own_read" on public.session_skips for select using (player_id = auth.uid());
-- Même fenêtre que le RPE : le jour même, ou la veille après une relance ; et seulement pour une activité sans RPE déclaré
create policy "skips_own_insert" on public.session_skips for insert with check (
  player_id = auth.uid() and public.can_log_day(session_date)
  and not exists (select 1 from public.session_logs l where l.player_id = auth.uid() and l.session_date = session_skips.session_date
                  and l.activity_type_id = session_skips.activity_type_id));
create policy "skips_own_delete" on public.session_skips for delete using (player_id = auth.uid() and public.can_log_day(session_date));
create policy "test_no_insert" on public.session_skips as restrictive for insert to authenticated with check (not public.is_test_user());
create policy "test_no_delete" on public.session_skips as restrictive for delete to authenticated using (not public.is_test_user());
create policy "skips_staff_delete" on public.session_skips for delete using (public.is_staff());

-- Une vraie saisie (joueur, staff, validation de séance) l'emporte : le « pas fait » correspondant disparaît
create function public.drop_skip_on_log() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.session_skips
  where player_id = new.player_id and session_date = new.session_date and activity_type_id = new.activity_type_id;
  return null;
end $$;
revoke execute on function public.drop_skip_on_log() from public, authenticated;
create trigger drop_skip_on_log after insert or update of activity_type_id, session_date on public.session_logs
  for each row execute function public.drop_skip_on_log();

-- Rappel de 20h : une activité déclarée non faite n'est plus à relancer
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
              and (ps.player_id is null or a.name not in ('Musculation', 'Réhabilitation', 'Membres sains') or l.validated_at is not null))
          and not exists (
            select 1 from public.session_skips k
            where k.player_id = s.player_id and k.session_date = v_today and k.activity_type_id = ps.activity_type_id))
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

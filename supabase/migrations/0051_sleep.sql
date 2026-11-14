-- Étape 14, module Sommeil (sous drapeau). Saisie du matin (champs du Consensus Sleep Diary), routines à cocher.
-- La qualité du sommeil (1 à 5) n'est pas stockée ici : elle est saisie juste avant dans l'état de forme (wellness_entries).
-- night_date = le jour du réveil. Heures locales (Europe/Paris) : coucher la veille au soir, réveil le matin.

-- Le joueur a un suivi sommeil actif et a donné son accord
create function public.has_follow(p_module text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_feature('suivi_individuel') and exists (
    select 1 from public.follow_enrollments
    where player_id = auth.uid() and module_code = p_module and status = 'actif' and consented_at is not null)
$$;
revoke execute on function public.has_follow(text) from public, anon;
grant execute on function public.has_follow(text) to authenticated;

create table public.sleep_entries (
  player_id      uuid not null references public.profiles(id) on delete cascade,
  night_date     date not null,
  bed_time       time not null,            -- au lit
  asleep_time    time not null,            -- endormi (estimation)
  wake_time      time not null,            -- réveil
  awakenings     smallint not null default 0 check (awakenings between 0 and 20),
  awake_min      smallint not null default 0 check (awake_min between 0 and 600),   -- temps éveillé pendant la nuit
  phone_free_min smallint not null check (phone_free_min between 0 and 600),        -- minutes sans téléphone avant de dormir
  feeling        text not null check (feeling in ('repose', 'fatigue')),
  nap_min        smallint check (nap_min between 0 and 300),
  caffeine_late  boolean,                  -- caféine après 16 h
  note           text check (length(note) <= 300),
  -- Durée de sommeil : de l'endormissement au réveil (nuit à cheval sur minuit), moins le temps éveillé
  duration_min   int generated always as (
    greatest(0, ((extract(epoch from wake_time)::int - extract(epoch from asleep_time)::int) / 60 + 1440) % 1440 - awake_min)) stored,
  created_at     timestamptz not null default now(),
  primary key (player_id, night_date),
  check (awakenings > 0 or awake_min = 0),
  -- endormi au plus 4 h après s'être mis au lit (sinon une heure a été mal saisie)
  constraint sleep_entries_latency check (((extract(epoch from asleep_time)::int - extract(epoch from bed_time)::int) / 60 + 1440) % 1440 <= 240)
);

create table public.sleep_routines (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.profiles(id) on delete cascade,
  label      text not null check (length(trim(label)) between 2 and 80),   -- « Écrans coupés à 22 h »
  active     boolean not null default true,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, player_id)
);
create index sleep_routines_player on public.sleep_routines (player_id);

create table public.sleep_routine_checks (
  routine_id uuid not null,
  player_id  uuid not null references public.profiles(id) on delete cascade,
  night_date date not null,
  primary key (routine_id, night_date),
  -- une coche ne peut viser que la routine du même joueur
  foreign key (routine_id, player_id) references public.sleep_routines (id, player_id) on delete cascade
);
create index sleep_checks_player on public.sleep_routine_checks (player_id, night_date);

alter table public.sleep_entries enable row level security;
alter table public.sleep_routines enable row level security;
alter table public.sleep_routine_checks enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sleep_entries', 'sleep_routines', 'sleep_routine_checks'] loop
    execute format('create policy "feature_gate" on public.%I as restrictive for all to authenticated
                    using (public.has_feature(''suivi_individuel'')) with check (public.has_feature(''suivi_individuel''))', t);
    -- Admin seul côté staff (D11), en lecture ; le joueur lit ses lignes
    execute format('create policy "admin_read" on public.%I for select using (public.is_admin())', t);
    execute format('create policy "own_read" on public.%I for select using (player_id = auth.uid())', t);
  end loop;
end $$;

-- Saisie : la nuit qui vient de finir (ou celle d'hier, oubliée), suivi sommeil actif et accepté
create policy "own_insert" on public.sleep_entries for insert with check (
  player_id = auth.uid() and public.has_follow('sommeil') and night_date between public.paris_today() - 1 and public.paris_today());
create policy "own_update" on public.sleep_entries for update
  using (player_id = auth.uid() and night_date between public.paris_today() - 1 and public.paris_today())
  with check (player_id = auth.uid() and public.has_follow('sommeil') and night_date between public.paris_today() - 1 and public.paris_today());

-- L'admin peut proposer ou retirer une routine ; il n'écrit ni les nuits ni les coches d'un joueur
create policy "admin_write" on public.sleep_routines for all using (public.is_admin()) with check (public.is_admin());
create policy "own_insert" on public.sleep_routines for insert with check (player_id = auth.uid() and public.has_follow('sommeil'));
create policy "own_update" on public.sleep_routines for update
  using (player_id = auth.uid()) with check (player_id = auth.uid() and public.has_follow('sommeil'));

create policy "own_insert" on public.sleep_routine_checks for insert with check (
  player_id = auth.uid() and public.has_follow('sommeil') and night_date between public.paris_today() - 1 and public.paris_today());
create policy "own_delete" on public.sleep_routine_checks for delete using (
  player_id = auth.uid() and night_date between public.paris_today() - 1 and public.paris_today());

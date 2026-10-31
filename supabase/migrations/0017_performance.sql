-- Étape 11a : onglet Performance — matchs, GPS par joueur et par match, référentiel par poste, notes de match.

-- Matchs du groupe (créés à l'import GPS ou à la main) : un joueur peut noter un match même sans GPS
create table public.matches (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  match_date date not null,
  opponent   text not null,
  label      text,                              -- 'J3 - R92'
  created_at timestamptz not null default now(),
  unique (group_id, match_date, opponent)
);

-- Attendus aux postes (A. Peters 2023, classeur « GPS - MATCH »), ramenés à un match de ref_minutes ; modifiables par le staff
create table public.gps_reference (
  position_group text primary key,               -- 'Pilier', '2e ligne'…
  distance_m     numeric not null check (distance_m > 0),
  accelerations  numeric not null check (accelerations > 0),
  accel_threshold text,                          -- '>6 m/s' (information)
  hi_distance_m  numeric not null check (hi_distance_m > 0),
  ref_minutes    numeric not null default 70 check (ref_minutes > 0)
);
insert into public.gps_reference (position_group, distance_m, accelerations, accel_threshold, hi_distance_m) values
  ('Pilier',           4970, 15, '>6 m/s', 10),
  ('Talonneur',        4970, 15, '>5 m/s', 10),
  ('2e ligne',         5670, 30, '>5 m/s', 20),
  ('3e ligne',         5670, 30, '>5 m/s', 20),
  ('Demi de mêlée',    5840, 30, '>5 m/s', 60),
  ('Demi d''ouverture', 5840, 30, '>5 m/s', 60),
  ('Centre',           6510, 30, '>5 m/s', 60),
  ('Ailier / Arrière', 6180, 30, '>5 m/s', 60);

-- Poste saisi (export GPS ou fiche joueur, en majuscules) → groupe de poste du référentiel
create table public.gps_positions (
  position       text primary key check (position = upper(trim(position))),
  position_group text not null references public.gps_reference(position_group) on update cascade
);
insert into public.gps_positions (position, position_group) values
  -- exports GPS (classeur « GPS - MATCH », onglet Référentiel)
  ('PILIER', 'Pilier'), ('TALON', 'Talonneur'), ('TALONNEUR', 'Talonneur'), ('2ÈME LIGNE', '2e ligne'),
  ('3ÈME LIGNE AILE', '3e ligne'), ('3ÈME LIGNE CENTRE', '3e ligne'), ('DEMI DE MÊLÉE', 'Demi de mêlée'),
  ('DEMI D''OUVERTURE', 'Demi d''ouverture'), ('CENTRE', 'Centre'), ('AILIER', 'Ailier / Arrière'), ('ARRIÈRE', 'Ailier / Arrière'),
  -- postes des fiches joueurs (profiles.position) ; charnière : mêmes attendus pour demi de mêlée et d'ouverture
  ('3ÈME LIGNE', '3e ligne'), ('CHARNIÈRE', 'Demi de mêlée');

-- GPS d'un joueur sur un match (export brut du GPS) ; poste du match, qui peut différer du poste habituel
create table public.gps_records (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references public.matches(id) on delete cascade,
  player_id     uuid not null references public.profiles(id) on delete cascade,
  position      text not null,
  minutes       numeric not null check (minutes > 0 and minutes <= 120),
  distance_m    numeric not null check (distance_m >= 0),
  hi_distance_m numeric not null check (hi_distance_m >= 0),
  accelerations numeric not null check (accelerations >= 0),
  vmax          numeric check (vmax > 0 and vmax < 45),
  created_at    timestamptz not null default now(),
  unique (match_id, player_id)
);

-- Note de match en 4 couleurs, indépendante des GPS : auto-évaluation du joueur et note du staff
create table public.match_ratings (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  player_id  uuid not null references public.profiles(id) on delete cascade,
  rater      text not null check (rater in ('player', 'staff')),
  color      text not null check (color in ('rouge', 'jaune', 'vert', 'bleu')),
  comment    text,
  rated_by   uuid references public.profiles(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id, rater)
);

alter table public.matches       enable row level security;
alter table public.gps_reference enable row level security;
alter table public.gps_positions enable row level security;
alter table public.gps_records   enable row level security;
alter table public.match_ratings enable row level security;

create policy "matches_read"   on public.matches       for select using (auth.uid() is not null);
create policy "matches_staff"  on public.matches       for all using (public.is_staff()) with check (public.is_staff());
create policy "gpsref_read"    on public.gps_reference for select using (auth.uid() is not null);
create policy "gpsref_staff"   on public.gps_reference for all using (public.is_staff()) with check (public.is_staff());
create policy "gpspos_read"    on public.gps_positions for select using (auth.uid() is not null);
create policy "gpspos_staff"   on public.gps_positions for all using (public.is_staff()) with check (public.is_staff());
create policy "gps_read"       on public.gps_records   for select using (player_id = auth.uid() or public.is_staff());
create policy "gps_staff"      on public.gps_records   for all using (public.is_staff()) with check (public.is_staff());

-- Le joueur ne découvre la note du staff qu'après s'être noté (fonction security definer : une politique qui relit sa
-- propre table bouclerait)
create function public.has_rated(p_match uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.match_ratings
                 where match_id = p_match and player_id = auth.uid() and rater = 'player')
$$;

create policy "ratings_read" on public.match_ratings for select using (
  public.is_staff() or (player_id = auth.uid() and (rater = 'player' or public.has_rated(match_id))));
-- Le joueur note un match de son groupe une fois celui-ci joué, et peut changer de couleur (pas de suppression : la note
-- staff est déjà vue). Le contrôle vaut aussi à la modification : sinon déplacer sa note vers un match à venir
-- révélerait la note staff de ce match avant de s'être noté.
create function public.can_rate_match(p_match uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.matches m
                 join public.group_members gm on gm.group_id = m.group_id and gm.player_id = auth.uid()
                 where m.id = p_match and m.match_date <= public.paris_today())
$$;
create policy "ratings_player_insert" on public.match_ratings for insert with check (
  player_id = auth.uid() and rater = 'player' and public.can_rate_match(match_id));
create policy "ratings_player_update" on public.match_ratings for update
  using (player_id = auth.uid() and rater = 'player')
  with check (player_id = auth.uid() and rater = 'player' and public.can_rate_match(match_id));
-- Le staff ne note qu'en tant que staff : il ne peut pas écrire l'auto-évaluation d'un joueur
create policy "ratings_staff" on public.match_ratings for all
  using (public.is_staff() and rater = 'staff') with check (public.is_staff() and rater = 'staff');

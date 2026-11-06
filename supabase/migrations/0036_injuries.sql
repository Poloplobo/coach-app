-- Module médical (décisions du 06/11/2026) : recensement automatique des blessures et plan de retour.
-- Données de santé de mineurs : la fiche blessure (diagnostic, classement, alertes) est réservée au staff ; le joueur lit
-- seulement les étapes de son plan de retour. Aucun document médical : le staff saisit le plan à partir des documents.

-- Fiche blessure, classement du consensus World Rugby / CIO (2020) pour l'épidémiologie du groupe
create table public.injuries (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.profiles(id) on delete cascade,
  occurred_on date not null,
  ended_on    date check (ended_on is null or ended_on >= occurred_on), -- retour « apte » : gravité = jours d'absence
  location    text check (location in ('tete', 'cou', 'epaule', 'bras', 'poignet_main', 'thorax', 'abdomen', 'lombaire_bassin',
                                       'hanche_aine', 'cuisse', 'genou', 'jambe', 'cheville', 'pied')),
  tissue      text check (tissue in ('muscle_tendon', 'nerveux', 'os', 'cartilage', 'ligament', 'peau', 'non_specifique')),
  mechanism   text check (mechanism in ('plaquant', 'plaque', 'ruck', 'maul', 'melee', 'touche', 'collision', 'sans_contact', 'autre')),
  onset       text check (onset in ('soudaine', 'progressive')),
  activity    text check (activity in ('match', 'entrainement', 'musculation', 'hors_rugby')),
  recurrence  boolean not null default false,
  diagnosis   text,
  notes       text,
  alerts      jsonb not null default '{}', -- instantané des 28 jours avant la blessure (wellness, charge)
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id) default auth.uid()
);
create unique index injuries_one_open on public.injuries (player_id) where ended_on is null;
alter table public.injuries enable row level security;
create policy "injuries_staff" on public.injuries for all using (public.is_staff()) with check (public.is_staff());

-- Plan de retour : étapes ordonnées, durée théorique, critères ; validées par le staff. player_id recopié pour que le
-- joueur lise son plan sans pouvoir lire la fiche blessure.
create table public.injury_steps (
  id           uuid primary key default gen_random_uuid(),
  injury_id    uuid not null references public.injuries(id) on delete cascade,
  player_id    uuid not null references public.profiles(id) on delete cascade,
  position     int not null,
  title        text not null check (length(trim(title)) > 0),
  criteria     text,
  planned_days int not null default 7 check (planned_days between 0 and 365),
  validated_on date,
  validated_by uuid references public.profiles(id)
);
create index on public.injury_steps (injury_id, position);
alter table public.injury_steps enable row level security;
create policy "injury_steps_staff" on public.injury_steps for all using (public.is_staff()) with check (public.is_staff());
create policy "injury_steps_own"   on public.injury_steps for select using (player_id = auth.uid());

-- Alertes des 28 jours qui précèdent la blessure : jours d'état de forme en alerte (score < 16/30 ou un item à 1),
-- items à 1, charge des 7 derniers jours et moyenne hebdomadaire des 28 jours
create function public.injury_alerts(p_player uuid, p_date date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'wellness_days', (select count(*) from public.wellness_entries w where w.player_id = p_player and w.entry_date between p_date - 27 and p_date),
    'alert_days', (select count(*) from public.wellness_entries w where w.player_id = p_player and w.entry_date between p_date - 27 and p_date
                     and (w.score < 16 or least(w.sleep_quality, w.fatigue, w.soreness_upper, w.soreness_lower, w.stress, w.mood) = 1)),
    'items_at_1', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
                     select v.k, count(*) as n from public.wellness_entries w,
                       lateral (values ('sommeil', w.sleep_quality), ('fatigue', w.fatigue), ('courbatures haut', w.soreness_upper),
                                       ('courbatures bas', w.soreness_lower), ('stress', w.stress), ('humeur', w.mood)) v(k, x)
                     where w.player_id = p_player and w.entry_date between p_date - 27 and p_date and v.x = 1 group by v.k) t),
    'acute', (select coalesce(round(sum(l.srpe)), 0) from public.session_logs l where l.player_id = p_player and l.session_date between p_date - 6 and p_date),
    'chronic', (select coalesce(round(sum(l.srpe) / 4), 0) from public.session_logs l where l.player_id = p_player and l.session_date between p_date - 27 and p_date))
$$;
revoke execute on function public.injury_alerts(uuid, date) from public, authenticated;

-- Plan de retour par défaut, ajustable par le staff pour chaque blessure
create function public.injury_default_steps(p_injury uuid, p_player uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.injury_steps (injury_id, player_id, position, title, criteria, planned_days) values
    (p_injury, p_player, 1, 'Soins et protection', 'Douleur au repos ≤ 2/10, consignes médicales respectées', 3),
    (p_injury, p_player, 2, 'Réathlétisation en salle', 'Amplitudes et force retrouvées, douleur à l''effort ≤ 3/10', 7),
    (p_injury, p_player, 3, 'Course individuelle', 'Course, appuis et changements de direction sans douleur', 7),
    (p_injury, p_player, 4, 'Collectif sans contact', 'Entraînement complet sans contact, charge proche du groupe', 7),
    (p_injury, p_player, 5, 'Entraînement avec contact', 'Contacts progressifs puis complets sans appréhension', 5),
    (p_injury, p_player, 6, 'Retour match', 'Feu vert médical et accord du staff', 0)
$$;
revoke execute on function public.injury_default_steps(uuid, uuid) from public, authenticated;

-- Joueur déclaré blessé : fiche blessure (avec ses alertes) et plan par défaut ; retour « apte » : fiche close
create function public.on_availability_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_injury uuid;
begin
  if new.status = 'blessé' and (tg_op = 'INSERT' or old.status <> 'blessé')
     and not exists (select 1 from public.injuries where player_id = new.player_id and ended_on is null) then
    insert into public.injuries (player_id, occurred_on, alerts)
    values (new.player_id, new.since, public.injury_alerts(new.player_id, new.since)) returning id into v_injury;
    perform public.injury_default_steps(v_injury, new.player_id);
  elsif new.status = 'apte' and tg_op = 'UPDATE' and old.status = 'blessé' then
    update public.injuries set ended_on = greatest(new.since, occurred_on) where player_id = new.player_id and ended_on is null;
  end if;
  return new;
end $$;
create trigger availability_injuries after insert or update of status on public.player_availability
  for each row execute function public.on_availability_change();

-- Joueurs déjà déclarés blessés : leur fiche et leur plan sont créés maintenant
do $$
declare r record; v uuid;
begin
  for r in select a.player_id, a.since from public.player_availability a where a.status = 'blessé'
           and not exists (select 1 from public.injuries i where i.player_id = a.player_id and i.ended_on is null) loop
    insert into public.injuries (player_id, occurred_on, alerts) values (r.player_id, r.since, public.injury_alerts(r.player_id, r.since)) returning id into v;
    perform public.injury_default_steps(v, r.player_id);
  end loop;
end $$;

-- Plan de retour du joueur connecté pour sa blessure en cours : étapes et date de début, jamais le diagnostic ni le classement
create function public.my_return_plan() returns table (occurred_on date, id uuid, step int, title text, criteria text, planned_days int, validated_on date)
language sql stable security definer set search_path = '' as $$
  select i.occurred_on, s.id, s.position, s.title, s.criteria, s.planned_days, s.validated_on
  from public.injuries i join public.injury_steps s on s.injury_id = i.id
  where i.player_id = auth.uid() and i.ended_on is null
  order by s.position
$$;

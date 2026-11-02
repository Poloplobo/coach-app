-- Onglet Performance > Match (décisions du 02/11/2026) :
-- - le calendrier des matchs est saisi pour la saison (fichier), indépendamment des GPS : domicile / extérieur, logo du club ;
-- - le joueur note seulement le match du week-end : le dernier match joué de son groupe, jusqu'au match suivant.
alter table public.matches add column home boolean;               -- vrai : à domicile ; null : non renseigné
alter table public.matches add column logo text                  -- fichier du logo dans /logos-clubs/ (ex. « lou.png »)
  check (logo is null or logo ~ '^[a-z0-9-]+\.(png|jpg|jpeg|webp|svg)$');

create or replace function public.can_rate_match(p_match uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.matches m
    join public.group_members gm on gm.group_id = m.group_id and gm.player_id = auth.uid()
    where m.id = p_match and m.match_date <= public.paris_today()
      -- dernier match joué : aucun match du groupe joué depuis
      and not exists (select 1 from public.matches later
                      where later.group_id = m.group_id and later.match_date > m.match_date
                        and later.match_date <= public.paris_today()))
$$;

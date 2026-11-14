-- Étape 14, module Nutrition, premier temps (sous drapeau) : aliments, journal par repas, hydratation.
-- Les aliments Ciqual (ANSES, Licence Ouverte 2.0) sont chargés par scripts/load-ciqual.mjs, jamais par migration.
-- Le joueur ne lit jamais une valeur nutritionnelle : elles sont dans food_nutrients, table de l'admin seul.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create table public.foods (
  id          uuid primary key default gen_random_uuid(),
  ciqual_code int unique,                                   -- aliment de la table Ciqual
  owner_id    uuid references public.profiles(id) on delete cascade,   -- aliment personnel d'un joueur
  name        text not null check (length(trim(name)) between 2 and 120),
  search      text not null default '',                     -- nom sans accents ni majuscules, posé par déclencheur
  -- Sert au « repas complet » (protéine, féculent, légume) : jamais calculé depuis les valeurs nutritionnelles
  category    text not null default 'autre' check (category in
              ('proteine', 'feculent', 'legume', 'fruit', 'laitier', 'plat', 'boisson', 'sucre', 'gras', 'autre')),
  created_at  timestamptz not null default now(),
  -- ni Ciqual ni personnel = aliment ajouté par le staff (cantine du pôle, compléments)
  check (ciqual_code is null or owner_id is null)
);
create index foods_owner on public.foods (owner_id) where owner_id is not null;

create function public.foods_set_search() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.search := lower(extensions.unaccent(new.name));
  return new;
end $$;
create trigger foods_search before insert or update of name on public.foods
  for each row execute function public.foods_set_search();

-- Valeurs pour 100 g, lues par l'admin seulement (apports estimés calculés côté staff)
create table public.food_nutrients (
  food_id   uuid primary key references public.foods(id) on delete cascade,
  kcal      numeric(6,1),
  protein_g numeric(5,1),
  carbs_g   numeric(5,1),
  fat_g     numeric(5,1)
);

create table public.meal_items (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  meal       text not null check (meal in ('petit_dejeuner', 'collation_matin', 'dejeuner', 'gouter', 'diner', 'collation_soir')),
  course     text check (course in ('entree', 'plat', 'dessert')),
  food_id    uuid not null references public.foods(id),
  quantity   numeric(7,2) not null check (quantity > 0 and quantity <= 5000),   -- 0,33 L reste 0,33
  unit       text not null check (length(unit) between 1 and 20),   -- g, mL, bol, poignée… (liste côté écran)
  grams      numeric(6,1) not null check (grams > 0 and grams <= 5000),   -- équivalent en grammes de la quantité
  created_at timestamptz not null default now(),
  check (course is null or meal in ('dejeuner', 'diner'))
);
create index meal_items_player_day on public.meal_items (player_id, day);
create index meal_items_food on public.meal_items (food_id);

create table public.hydration_entries (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  ml         smallint not null check (ml between 50 and 2000),
  created_at timestamptz not null default now()
);
create index hydration_player_day on public.hydration_entries (player_id, day);

alter table public.foods enable row level security;
alter table public.food_nutrients enable row level security;
alter table public.meal_items enable row level security;
alter table public.hydration_entries enable row level security;

do $$
declare t text;
begin
  foreach t in array array['foods', 'food_nutrients', 'meal_items', 'hydration_entries'] loop
    execute format('create policy "feature_gate" on public.%I as restrictive for all to authenticated
                    using (public.has_feature(''suivi_individuel'')) with check (public.has_feature(''suivi_individuel''))', t);
  end loop;
  -- Journal et hydratation : admin seul côté staff (D11), en lecture ; le joueur lit, écrit et corrige aujourd'hui et hier
  foreach t in array array['meal_items', 'hydration_entries'] loop
    execute format('create policy "admin_read" on public.%I for select using (public.is_admin())', t);
    execute format('create policy "own_read" on public.%I for select using (player_id = auth.uid())', t);
    execute format('create policy "own_insert" on public.%I for insert with check (
      player_id = auth.uid() and public.has_follow(''nutrition'') and day between public.paris_today() - 1 and public.paris_today())', t);
    execute format('create policy "own_delete" on public.%I for delete using (
      player_id = auth.uid() and day between public.paris_today() - 1 and public.paris_today())', t);
  end loop;
end $$;

create policy "own_update" on public.meal_items for update
  using (player_id = auth.uid() and day between public.paris_today() - 1 and public.paris_today())
  with check (player_id = auth.uid() and public.has_follow('nutrition') and day between public.paris_today() - 1 and public.paris_today());

-- Un repas ne peut citer qu'un aliment que son auteur peut lire (la clé étrangère, elle, ignore la RLS) :
-- sinon l'aliment personnel d'un autre joueur pourrait être visé, et bloquerait la suppression de son compte
create policy "visible_food" on public.meal_items as restrictive for all to authenticated
  using (true) with check (exists (select 1 from public.foods f where f.id = food_id));

-- Plafond d'aliments personnels (une politique de foods ne peut pas compter dans foods : récursion)
create function public.own_food_count() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.foods where owner_id = auth.uid()
$$;
revoke execute on function public.own_food_count() from public, anon;
grant execute on function public.own_food_count() to authenticated;

-- Aliments : Ciqual et aliments du staff lisibles de tous (sous drapeau) ; un aliment personnel, de son auteur et de l'admin
create policy "read" on public.foods for select to authenticated using (owner_id is null or owner_id = auth.uid() or public.is_admin());
create policy "admin_write" on public.foods for all using (public.is_admin()) with check (public.is_admin());
create policy "own_insert" on public.foods for insert with check (
  owner_id = auth.uid() and ciqual_code is null and public.has_follow('nutrition') and public.own_food_count() < 200);

create policy "admin_all" on public.food_nutrients for all using (public.is_admin()) with check (public.is_admin());

-- Recherche instantanée, sans accents, tolérante aux fautes. Droits de l'appelant : la RLS de foods s'applique.
-- Pas d'index trigramme : quelques milliers de lignes, le parcours complet reste sous la milliseconde.
create function public.search_foods(p_term text)
returns table (id uuid, name text, category text, personal boolean)
language sql stable set search_path = '' as $$
  select f.id, f.name, f.category, f.owner_id is not null
  from public.foods f, (select lower(extensions.unaccent(left(trim(p_term), 51))) as t) q
  where length(q.t) between 2 and 50
    and (position(q.t in f.search) > 0 or q.t operator(extensions.<%) f.search)
  -- d'abord les noms qui commencent par le terme ; viandes et féculents crus après les cuits (on mange cuit)
  order by starts_with(f.search, q.t) desc, position(q.t in f.search) > 0 desc,
           (f.category in ('proteine', 'feculent') and f.search ~ '\mcru(e|s|es)?\M'),
           extensions.word_similarity(q.t, f.search) desc, length(f.name)
  limit 30
$$;
revoke execute on function public.search_foods(text) from public, anon;
grant execute on function public.search_foods(text) to authenticated;

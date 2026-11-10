-- Référentiel coqs FFR « Génération bleue » (janvier 2025), barème garçons, par poste (décision du 10/11/2026).
-- Coq bleu / vert / jaune : seuil atteint (≥, ou ≤ pour un temps) ; en dessous du jaune : coq rouge. Entre deux seuils :
-- l'échelon inférieur. DC et squat sont en 1RM : les tests 3RM sont convertis côté app (src/features/tests/coqs.ts).
create table public.test_reference (
  test_id        uuid not null references public.test_definitions(id) on delete cascade,
  position_group text not null check (position_group in ('Pilier', 'Talonneur', '2e ligne', '3e ligne', 'Demi de mêlée',
                                                          'Demi d''ouverture', 'Centre', 'Ailier', 'Arrière')),
  blue           numeric not null check (blue > 0),
  green          numeric not null check (green > 0),
  yellow         numeric not null check (yellow > 0),
  primary key (test_id, position_group)
);
alter table public.test_reference enable row level security;
-- Barème public de la fédération : lisible par tout compte connecté (le joueur voit ses coqs), modifiable par le staff
create policy "test_reference_read" on public.test_reference for select to authenticated using (true);
create policy "test_reference_staff" on public.test_reference for all using (public.is_staff()) with check (public.is_staff());

insert into public.test_reference (test_id, position_group, blue, green, yellow)
select d.id, v.position_group, v.blue, v.green, v.yellow
from (values
  ('Développé Couché 1RM', 'Pilier', 125.5, 115, 105),
  ('Développé Couché 1RM', 'Talonneur', 122.5, 115, 105),
  ('Développé Couché 1RM', '2e ligne', 110, 100, 90),
  ('Développé Couché 1RM', '3e ligne', 115, 105, 95),
  ('Développé Couché 1RM', 'Demi de mêlée', 105, 95, 87.5),
  ('Développé Couché 1RM', 'Demi d''ouverture', 105, 95, 87.5),
  ('Développé Couché 1RM', 'Centre', 110, 105, 95),
  ('Développé Couché 1RM', 'Ailier', 110, 100, 90),
  ('Développé Couché 1RM', 'Arrière', 105, 95, 87.5),
  ('Back Squat 1RM', 'Pilier', 182.5, 167.5, 140),
  ('Back Squat 1RM', 'Talonneur', 160, 150, 120),
  ('Back Squat 1RM', '2e ligne', 150, 145, 130),
  ('Back Squat 1RM', '3e ligne', 160, 150, 120),
  ('Back Squat 1RM', 'Demi de mêlée', 145, 135, 105),
  ('Back Squat 1RM', 'Demi d''ouverture', 145, 135, 105),
  ('Back Squat 1RM', 'Centre', 160, 145, 115),
  ('Back Squat 1RM', 'Ailier', 155, 140, 130),
  ('Back Squat 1RM', 'Arrière', 155, 140, 130),
  ('Broad Jump', 'Pilier', 244, 230, 220),
  ('Broad Jump', 'Talonneur', 258, 240, 235),
  ('Broad Jump', '2e ligne', 254, 236, 229),
  ('Broad Jump', '3e ligne', 260, 250, 244),
  ('Broad Jump', 'Demi de mêlée', 262, 256, 248),
  ('Broad Jump', 'Demi d''ouverture', 262, 256, 248),
  ('Broad Jump', 'Centre', 267, 257, 250),
  ('Broad Jump', 'Ailier', 276, 264, 251),
  ('Broad Jump', 'Arrière', 274, 262, 250),
  ('CMJ', 'Pilier', 36, 33, 29),
  ('CMJ', 'Talonneur', 40, 37, 34),
  ('CMJ', '2e ligne', 38, 34, 30),
  ('CMJ', '3e ligne', 40, 37, 34),
  ('CMJ', 'Demi de mêlée', 43, 40, 37),
  ('CMJ', 'Demi d''ouverture', 42, 37, 35),
  ('CMJ', 'Centre', 42, 40, 36),
  ('CMJ', 'Ailier', 47, 42, 39),
  ('CMJ', 'Arrière', 44, 41, 38),
  ('Sprint 10m', 'Pilier', 1.85, 1.93, 2.01),
  ('Sprint 10m', 'Talonneur', 1.79, 1.87, 1.95),
  ('Sprint 10m', '2e ligne', 1.75, 1.83, 1.9),
  ('Sprint 10m', '3e ligne', 1.72, 1.78, 1.84),
  ('Sprint 10m', 'Demi de mêlée', 1.67, 1.71, 1.8),
  ('Sprint 10m', 'Demi d''ouverture', 1.69, 1.73, 1.82),
  ('Sprint 10m', 'Centre', 1.67, 1.71, 1.8),
  ('Sprint 10m', 'Ailier', 1.64, 1.69, 1.77),
  ('Sprint 10m', 'Arrière', 1.65, 1.69, 1.78),
  ('Sprint 50m', 'Pilier', 6.79, 6.98, 7.18),
  ('Sprint 50m', 'Talonneur', 6.55, 6.71, 6.9),
  ('Sprint 50m', '2e ligne', 6.59, 6.77, 7.09),
  ('Sprint 50m', '3e ligne', 6.46, 6.65, 6.81),
  ('Sprint 50m', 'Demi de mêlée', 6.32, 6.44, 6.54),
  ('Sprint 50m', 'Demi d''ouverture', 6.37, 6.49, 6.62),
  ('Sprint 50m', 'Centre', 6.26, 6.37, 6.55),
  ('Sprint 50m', 'Ailier', 6.07, 6.25, 6.36),
  ('Sprint 50m', 'Arrière', 6.18, 6.3, 6.4),
  ('Yo-Yo Test', 'Pilier', 1400, 1160, 960),
  ('Yo-Yo Test', 'Talonneur', 1760, 1400, 1080),
  ('Yo-Yo Test', '2e ligne', 1760, 1400, 1080),
  ('Yo-Yo Test', '3e ligne', 2020, 1680, 1300),
  ('Yo-Yo Test', 'Demi de mêlée', 2360, 2180, 1940),
  ('Yo-Yo Test', 'Demi d''ouverture', 2280, 2120, 1680),
  ('Yo-Yo Test', 'Centre', 2280, 2120, 1680),
  ('Yo-Yo Test', 'Ailier', 2300, 2140, 1680),
  ('Yo-Yo Test', 'Arrière', 2320, 2160, 1680)
) as v(test_name, position_group, blue, green, yellow)
join public.test_definitions d on d.name = v.test_name;

-- Médailles = podium du groupe (décision du 10/11/2026) : pour chaque test, les 3 meilleurs derniers résultats des joueurs
-- actifs du groupe (ex aequo : même médaille). Le joueur ne reçoit que ses propres médailles, jamais les valeurs des autres.
create function public.my_test_medals() returns table (test_id uuid, medal text)
language sql stable security definer set search_path = '' as $$
  with mates as (
    select distinct gm2.player_id from public.group_members gm
    join public.group_members gm2 on gm2.group_id = gm.group_id
    join public.profiles p on p.id = gm2.player_id and p.is_active and (not p.is_test or p.id = auth.uid()) -- compte de test : classé pour lui seul
    where gm.player_id = auth.uid()
  ), latest as (
    select distinct on (r.player_id, r.test_id) r.player_id, r.test_id, r.value
    from public.test_results r join mates m on m.player_id = r.player_id
    order by r.player_id, r.test_id, r.test_date desc
  ), ranked as (
    select l.player_id, l.test_id,
      dense_rank() over (partition by l.test_id order by case when d.higher_is_better then -l.value else l.value end) rk
    from latest l join public.test_definitions d on d.id = l.test_id
  )
  select test_id, (array['or', 'argent', 'bronze'])[rk] from ranked where player_id = auth.uid() and rk <= 3
$$;
revoke execute on function public.my_test_medals() from public, anon;
grant execute on function public.my_test_medals() to authenticated;

-- Tests du fichier « TESTING COMPLET - CRABOS 2026/27 » absents du référentiel :
-- DC et FS se passent en 1RM ou 3RM (3RM par défaut), le DM en 3RM ; force cervicale mesurée au K-Push.
insert into public.test_definitions (name, category, unit, higher_is_better) values
  ('Développé Couché 3RM',     'force',     'kg',   true),
  ('Front Squat 1RM',          'force',     'kg',   true),
  ('Développé Militaire 3RM',  'force',     'kg',   true),
  ('K-Push Flexion',           'cervicale', 'N/kg', true),
  ('K-Push Extension',         'cervicale', 'N/kg', true);

-- Étape 9 : bilan de cycle. Un objectif chiffré porte sur un test (« Développé Couché 1RM ») ; sa progression se lit
-- sur l'exercice correspondant (« Développé Couché »). Lien saisi une fois par le staff (RLS tests_def_staff).
alter table public.test_definitions add column exercise_id uuid references public.exercises(id) on delete set null;

-- Pré-rempli quand le nom du test est celui de l'exercice suivi de « 1RM », « 3RM »… (sans tenir compte de la casse)
update public.test_definitions t set exercise_id = e.id
from public.exercises e
where lower(trim(e.name)) = lower(trim(regexp_replace(t.name, '\s*\d+\s*RM$', '', 'i')));

-- Plan de réhabilitation détaillé (décision du 06/11/2026), sur le modèle du plan du staff : phases avec leur durée,
-- étapes avec objectifs, actions kiné, actions prépa, statut, commentaire ; les tests et contrôles mis en avant.
-- Le joueur voit ses étapes, objectifs et actions prépa ; jamais les actions kiné ni les commentaires (médecins, diagnostic).
alter table public.injury_steps
  add column phase text,                                   -- « Phase 1 : Soins & Immobilisation coude au corps (S1-S2) »
  add column phase_days int check (phase_days between 0 and 365),
  add column objectives text,
  add column kine_actions text,                            -- staff seulement
  add column prepa_actions text,
  add column comment text,                                 -- staff seulement
  add column is_test boolean not null default false,
  add column in_progress boolean not null default false;   -- « En cours » (plusieurs étapes peuvent l'être en même temps)

-- Le joueur ne lit plus la table directement (elle contient des colonnes réservées au staff) : seulement my_return_plan()
drop policy "injury_steps_own" on public.injury_steps;

drop function public.my_return_plan();
create function public.my_return_plan() returns table (occurred_on date, id uuid, step int, title text, criteria text, planned_days int,
  validated_on date, phase text, phase_days int, objectives text, prepa_actions text, is_test boolean, in_progress boolean)
language sql stable security definer set search_path = '' as $$
  select i.occurred_on, s.id, s.position, s.title, s.criteria, s.planned_days, s.validated_on, s.phase, s.phase_days, s.objectives,
         s.prepa_actions, s.is_test, s.in_progress
  from public.injuries i join public.injury_steps s on s.injury_id = i.id
  where i.player_id = auth.uid() and i.ended_on is null
  order by s.position
$$;

-- Import d'un plan (fichier lu dans le navigateur) : remplace toutes les étapes de la blessure, en une transaction
create function public.import_injury_plan(p_injury uuid, p_steps jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_player uuid;
begin
  if not public.is_staff() then raise exception 'réservé au staff' using errcode = '42501'; end if;
  select player_id into v_player from public.injuries where id = p_injury;
  if v_player is null then raise exception 'blessure introuvable' using errcode = 'P0002'; end if;
  if jsonb_array_length(p_steps) = 0 then raise exception 'plan vide' using errcode = 'P0001'; end if;
  delete from public.injury_steps where injury_id = p_injury;
  insert into public.injury_steps (injury_id, player_id, position, title, criteria, planned_days, validated_on, phase, phase_days,
    objectives, kine_actions, prepa_actions, comment, is_test, in_progress)
  select p_injury, v_player, ord::int, trim(s->>'title'), nullif(s->>'criteria', ''), coalesce((s->>'planned_days')::int, 0),
         (s->>'validated_on')::date, nullif(s->>'phase', ''), (s->>'phase_days')::int, nullif(s->>'objectives', ''),
         nullif(s->>'kine_actions', ''), nullif(s->>'prepa_actions', ''), nullif(s->>'comment', ''),
         coalesce((s->>'is_test')::boolean, false), coalesce((s->>'in_progress')::boolean, false)
  from jsonb_array_elements(p_steps) with ordinality as x(s, ord);
  return jsonb_array_length(p_steps);
end $$;

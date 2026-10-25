-- Lancer : npx supabase test db --db-url "<chaîne de connexion du projet dev>"
-- Un joueur ne doit jamais voir ni écrire les données d'un autre joueur, ni modifier une saisie verrouillée.
-- Utilisateurs : A et B joueurs, C coach, M admin.
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.fr'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.fr'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.fr'),
  ('00000000-0000-0000-0000-00000000000d', 'm@test.fr');
insert into public.profiles (id, first_name, last_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Joueur', 'A', 'player'),
  ('00000000-0000-0000-0000-00000000000b', 'Joueur', 'B', 'player'),
  ('00000000-0000-0000-0000-00000000000c', 'Coach',  'C', 'coach'),
  ('00000000-0000-0000-0000-00000000000d', 'Admin',  'M', 'admin');

-- B est inscrit dans deux saisons, seule 26/27 a une semaine qui couvre sa séance
insert into public.groups (id, name, season) values
  ('00000000-0000-0000-0000-000000000001', 'Crabos 25/26', '2025-2026'),
  ('00000000-0000-0000-0000-000000000002', 'Crabos 26/27', '2026-2027');
insert into public.group_members (group_id, player_id) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b');
insert into public.season_weeks (group_id, code, start_date, week_type_code) values
  ('00000000-0000-0000-0000-000000000001', 'S1', '2025-09-08', 'DEV'),
  ('00000000-0000-0000-0000-000000000002', 'S1', '2026-09-07', 'DEV');
insert into public.session_logs (player_id, session_date, duration_min, rpe, source) values
  ('00000000-0000-0000-0000-00000000000b', '2026-09-08', 60, 5, 'import_form');
insert into public.wellness_entries (player_id, entry_date, sleep_quality, fatigue, soreness_upper, soreness_lower, stress, mood) values
  ('00000000-0000-0000-0000-00000000000b', public.paris_today(),     1, 1, 1, 1, 1, 1),
  ('00000000-0000-0000-0000-00000000000a', public.paris_today() - 1, 3, 3, 3, 3, 3, 3);
insert into public.player_season_profiles (player_id, season, health_objective) values
  ('00000000-0000-0000-0000-00000000000b', '2026-2027', 'genou');

-- Séances de muscu du jour : une pour B, deux pour A (dont une déjà validée)
insert into public.exercises (id, name) values ('00000000-0000-0000-0000-0000000000e1', 'Squat test');
insert into public.planned_sessions (id, session_date, title, player_id, activity_type_id) values
  ('00000000-0000-0000-0000-0000000000b1', public.paris_today(), 'Muscu B',        '00000000-0000-0000-0000-00000000000b', (select id from public.activity_types where name = 'Musculation')),
  ('00000000-0000-0000-0000-0000000000a1', public.paris_today(), 'Muscu A',        '00000000-0000-0000-0000-00000000000a', (select id from public.activity_types where name = 'Musculation')),
  ('00000000-0000-0000-0000-0000000000a2', public.paris_today(), 'Muscu A validée','00000000-0000-0000-0000-00000000000a', (select id from public.activity_types where name = 'Musculation'));
insert into public.planned_exercises (id, planned_session_id, exercise_id, position) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1', 1),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 1),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e1', 1);
insert into public.session_logs (player_id, planned_session_id, session_date, activity_type_id, duration_min, rpe, validated_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', public.paris_today(),
   (select id from public.activity_types where name = 'Musculation'), 60, 6, now());


-- Duplication (étape 8) : semaine source du lundi 2030-01-07, cibles S90 (normale) et S91 (OFF)
insert into public.season_weeks (group_id, code, start_date, week_type_code, is_off) values
  ('00000000-0000-0000-0000-000000000002', 'S90', '2030-01-14', 'DEV', false),
  ('00000000-0000-0000-0000-000000000002', 'S91', '2030-01-21', 'DEV', true);
insert into public.planned_sessions (id, session_date, title, group_id, player_id, activity_type_id) values
  ('00000000-0000-0000-0000-0000000000c1', '2030-01-08', 'Jeu au Poste', '00000000-0000-0000-0000-000000000002', null, (select id from public.activity_types where name = 'Jeu au Poste')),
  ('00000000-0000-0000-0000-0000000000c2', '2030-01-09', 'Musculation', null, '00000000-0000-0000-0000-00000000000b', (select id from public.activity_types where name = 'Musculation')),
  ('00000000-0000-0000-0000-0000000000c3', '2030-01-09', 'Musculation', null, '00000000-0000-0000-0000-00000000000a', (select id from public.activity_types where name = 'Musculation'));
-- Duplication vers une semaine déjà passée (2019-12-30 -> 2020-01-06)
insert into public.season_weeks (group_id, code, start_date, week_type_code, is_off) values
  ('00000000-0000-0000-0000-000000000002', 'S80', '2020-01-06', 'DEV', false);
insert into public.planned_sessions (session_date, title, group_id, activity_type_id) values
  ('2019-12-31', 'Jeu au Poste', '00000000-0000-0000-0000-000000000002', (select id from public.activity_types where name = 'Jeu au Poste'));
insert into public.planned_exercises (id, planned_session_id, exercise_id, position, load_value, load_unit) values
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000e1', 1, 100, 'kg');

-- Retour de B (pour vérifier qu'A ne le lit pas)
insert into public.exercise_feedback (player_id, planned_exercise_id, status, done_load) values
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000f1', 'fait', 'secret B');

-- ---------- Schéma ----------
-- Historique importé : ancienne colonne soreness seule, comptée pour les deux zones (score sur 30)
insert into public.wellness_entries (player_id, entry_date, sleep_quality, fatigue, soreness, stress, mood)
  values ('00000000-0000-0000-0000-00000000000a', public.paris_today() - 5, 3, 3, 2, 3, 3);
select is((select score from public.wellness_entries where entry_date = public.paris_today() - 5 and player_id = '00000000-0000-0000-0000-00000000000a'),
          16::smallint, 'ligne historique (soreness seule) = score sur 30');
select throws_ok($$insert into public.wellness_entries (player_id, entry_date, sleep_quality, fatigue, stress, mood)
                   values ('00000000-0000-0000-0000-00000000000a', public.paris_today() - 6, 3, 3, 3, 3)$$,
                 '23514', null, 'courbatures obligatoires (au moins soreness ou haut + bas)');
select is((select count(*) from public.weekly_player_load where player_id = '00000000-0000-0000-0000-00000000000b'),
          1::bigint, 'une séance n''est comptée que dans un seul groupe');
select is((select score from public.wellness_entries where player_id = '00000000-0000-0000-0000-00000000000b'),
          6::smallint, 'forme tout à 1 = 6/30');
select is((select status || ' ' || pct_target from public.weekly_player_load where player_id = '00000000-0000-0000-0000-00000000000b'),
          'sous-charge 10.0', 'statut selon la plage DEV (300 UA < 2500), % de la cible 3000 affiché');
select throws_ok($$insert into public.planned_sessions (session_date, title, player_id, activity_type_id)
                   select session_date, title, player_id, activity_type_id from public.planned_sessions
                   where id = '00000000-0000-0000-0000-0000000000b1'$$,
                 '23505', null, 'une séance planifiée ne peut pas être importée deux fois');

-- ---------- Joueur A ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select is_empty($$select 1 from public.wellness_entries       where player_id = '00000000-0000-0000-0000-00000000000b'$$, 'A ne voit pas le wellness de B');
select is_empty($$select 1 from public.session_logs           where player_id = '00000000-0000-0000-0000-00000000000b'$$, 'A ne voit pas les séances de B');
select is_empty($$select 1 from public.player_season_profiles where player_id = '00000000-0000-0000-0000-00000000000b'$$, 'A ne voit pas l''objectif santé de B');
select is_empty($$select 1 from public.weekly_player_load     where player_id = '00000000-0000-0000-0000-00000000000b'$$, 'A ne voit pas la charge de B');
select throws_ok($$insert into public.wellness_entries (player_id, sleep_quality, fatigue, soreness_upper, soreness_lower, stress, mood)
                   values ('00000000-0000-0000-0000-00000000000b', 5, 5, 5, 5, 5, 5)$$,
                 '42501', null, 'A ne peut pas écrire le wellness de B');
select throws_ok($$insert into public.wellness_entries (player_id, sleep_quality, fatigue, soreness_upper, soreness_lower, stress, mood, source)
                   values ('00000000-0000-0000-0000-00000000000a', 4, 4, 4, 4, 4, 4, 'staff')$$,
                 '42501', null, 'A ne peut pas marquer son état de forme comme saisi par le staff');
select is_empty($$update public.wellness_entries set mood = 5
                  where player_id = '00000000-0000-0000-0000-00000000000a' returning 1$$,
                'A ne peut pas modifier le wellness d''hier');
select throws_ok($$insert into public.session_logs (player_id, session_date, activity_type_id, duration_min, rpe, source)
                   values ('00000000-0000-0000-0000-00000000000a', public.paris_today(),
                           (select id from public.activity_types where name = 'Vidéo'), 25, null, 'staff')$$,
                 '42501', null, 'A ne peut pas se faire passer pour le staff');
select lives_ok($$insert into public.session_logs (player_id, session_date, activity_type_id, duration_min, rpe)
                  values ('00000000-0000-0000-0000-00000000000a', public.paris_today(),
                          (select id from public.activity_types where name = 'Vidéo'), 25, null)$$,
                'A saisit une activité du jour');
select throws_ok($$insert into public.session_logs (player_id, session_date, activity_type_id, duration_min, rpe)
                   values ('00000000-0000-0000-0000-00000000000a', public.paris_today(),
                           (select id from public.activity_types where name = 'Vidéo'), 25, null)$$,
                 '23505', null, 'A ne peut pas saisir deux fois la même activité le même jour');
select is_empty($$update public.session_logs set rpe = 2
                  where player_id = '00000000-0000-0000-0000-00000000000a' and validated_at is not null returning 1$$,
                'A ne peut pas modifier une séance validée');
select lives_ok($$insert into public.exercise_feedback (player_id, planned_exercise_id, status)
                  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f2', 'fait')$$,
                'A saisit le retour d''un exercice de sa séance du jour');
select throws_ok($$insert into public.exercise_feedback (player_id, planned_exercise_id, status)
                   values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f3', 'fait')$$,
                 '42501', null, 'A ne peut plus saisir sur une séance validée');
select throws_ok($$insert into public.exercise_feedback (player_id, planned_exercise_id, status)
                   values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f1', 'fait')$$,
                 '42501', null, 'A ne peut pas saisir sur un exercice de la séance de B');
select is_empty($$select 1 from public.exercise_feedback where player_id = '00000000-0000-0000-0000-00000000000b'$$,
                'A ne lit pas le retour d''exercice de B');
select is_empty($$update public.exercise_feedback set status = 'non fait'
                  where player_id = '00000000-0000-0000-0000-00000000000b' returning 1$$,
                'A ne modifie pas le retour d''exercice de B');

-- ---------- Coach C ----------
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;

select isnt_empty($$select 1 from public.wellness_entries where player_id = '00000000-0000-0000-0000-00000000000b'$$,
                  'le staff voit le wellness des joueurs');
select throws_ok($$insert into public.player_availability (player_id, status)
                   values ('00000000-0000-0000-0000-00000000000b', 'blessé')$$,
                 '42501', null, 'un coach ne peut pas changer le statut blessé / apte');
select is_empty($$update public.profiles set role = 'admin'
                  where id = '00000000-0000-0000-0000-00000000000c' returning 1$$,
                'un coach ne peut pas se donner le rôle admin');
select is_empty($$delete from public.profiles where id = '00000000-0000-0000-0000-00000000000b' returning 1$$,
                'un coach ne peut pas supprimer le profil d''un joueur');
select lives_ok($$insert into public.session_logs (player_id, session_date, activity_type_id, duration_min, rpe, source)
                  values ('00000000-0000-0000-0000-00000000000b', public.paris_today() - 3,
                          (select id from public.activity_types where name = 'Jeu au Poste'), 45, 6, 'staff')$$,
                'le staff corrige un oubli de RPE sur un jour passé (saisi par le staff)');
select lives_ok($$insert into public.wellness_entries (player_id, entry_date, sleep_quality, fatigue, soreness_upper, soreness_lower, stress, mood, source)
                  values ('00000000-0000-0000-0000-00000000000b', public.paris_today() - 3, 4, 4, 4, 4, 4, 4, 'staff')$$,
                'le staff corrige un état de forme sur un jour passé');
select is((select source from public.wellness_entries where player_id = '00000000-0000-0000-0000-00000000000b' and entry_date = public.paris_today() - 3),
          'staff', 'la correction de l''état de forme est marquée « saisi par le staff »');

-- Programmation (étape 6) : le staff enregistre une séance de musculation en une fois
select lives_ok($$insert into public.planned_sessions (id, session_date, title, player_id, activity_type_id)
                  values ('00000000-0000-0000-0000-0000000000b2', public.paris_today() + 2, 'Musculation', '00000000-0000-0000-0000-00000000000b',
                          (select id from public.activity_types where name = 'Musculation'))$$,
                'le staff programme une séance de musculation à venir');
select lives_ok($$select public.save_muscu_exercises('00000000-0000-0000-0000-0000000000b2',
                  '[{"exercise_id":"00000000-0000-0000-0000-0000000000e1","block_label":"A1","sets":5,"reps":"5","load_value":80,"load_unit":"pct_rm"},
                    {"exercise_id":"00000000-0000-0000-0000-0000000000e1","block_label":"B1","reps":"8"}]')$$,
                'le staff enregistre les exercices d''une séance');
select lives_ok($$select public.save_muscu_exercises('00000000-0000-0000-0000-0000000000b2', (
                  select jsonb_agg(jsonb_build_object('id', id, 'exercise_id', exercise_id, 'block_label', block_label) order by position desc)
                  from public.planned_exercises where planned_session_id = '00000000-0000-0000-0000-0000000000b2'))$$,
                'réordonner les exercices ne heurte pas la clé unique (séance, position)');
select is((select block_label from public.planned_exercises where planned_session_id = '00000000-0000-0000-0000-0000000000b2' and position = 1),
          'B1', 'le nouvel ordre est enregistré');
select throws_ok($$select public.save_muscu_exercises('00000000-0000-0000-0000-0000000000b1', '[]')$$,
                 'P0001', null, 'un exercice déjà renseigné par le joueur ne peut pas être supprimé');
select throws_ok($$select public.save_muscu_exercises('00000000-0000-0000-0000-0000000000b2',
                   '[{"id":"00000000-0000-0000-0000-0000000000f1","exercise_id":"00000000-0000-0000-0000-0000000000e1"}]')$$,
                 'P0001', null, 'l''exercice d''une autre séance ne peut pas être modifié par ce biais');
select throws_ok($$with s as (insert into public.planned_sessions (session_date, title, player_id, activity_type_id)
                     values (public.paris_today() - 1, 'Musculation', '00000000-0000-0000-0000-00000000000b',
                             (select id from public.activity_types where name = 'Musculation')) returning id)
                   select public.save_muscu_exercises((select id from s), '[]')$$,
                 'P0001', null, 'une séance passée n''est pas modifiable');

-- Duplication de semaine (étape 8)
select is((public.duplicate_week('00000000-0000-0000-0000-000000000002', '2030-01-07', '2030-01-14',
            '{"00000000-0000-0000-0000-0000000000f4": 102.5}') - 'skipped'),
          '{"group": 1, "individual": 1}'::jsonb, 'le staff duplique le planning du groupe et la séance individuelle');
select is((select pe.load_value from public.planned_exercises pe join public.planned_sessions ps on ps.id = pe.planned_session_id
           where ps.session_date = '2030-01-16' and ps.player_id = '00000000-0000-0000-0000-00000000000b'),
          102.5::numeric, 'la charge recalculée est appliquée à la copie');
select is(public.duplicate_week('00000000-0000-0000-0000-000000000002', '2030-01-07', '2030-01-14'),
          '{"group": 0, "individual": 0, "skipped": 2}'::jsonb, 'dupliquer deux fois ne crée pas de doublon');
select is((public.duplicate_week('00000000-0000-0000-0000-000000000002', '2030-01-07', '2030-01-21') ->> 'group')::int,
          0, 'semaine OFF : le planning du groupe n''est pas copié');
select is(public.duplicate_week('00000000-0000-0000-0000-000000000002', '2019-12-30', '2020-01-06'),
          '{"group": 0, "individual": 0, "skipped": 1}'::jsonb, 'les jours cibles déjà passés ne sont pas copiés');
select throws_ok($$select public.duplicate_week('00000000-0000-0000-0000-000000000002', '2030-01-07', '2030-01-28')$$,
                 'P0002', null, 'une semaine absente du calendrier ne peut pas être remplie');
select is((select count(*)::int from public.planned_sessions where session_date = '2030-01-16'
           and player_id = '00000000-0000-0000-0000-00000000000a'),
          0, 'la séance d''un joueur hors du groupe n''est pas copiée');
select throws_ok($$select public.duplicate_week('00000000-0000-0000-0000-000000000002', '2030-01-07', '2030-01-14',
                   '{"00000000-0000-0000-0000-0000000000f4": "NaN"}')$$,
                 'P0001', null, 'une charge invalide est refusée');

-- ---------- Admin M ----------
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$select public.save_muscu_exercises('00000000-0000-0000-0000-0000000000b2',
                  '[{"exercise_id":"00000000-0000-0000-0000-0000000000e1","block_label":"A1","reps":"3"}]')$$,
                'un admin programme aussi les séances de musculation');
select throws_ok($$insert into public.exercises (name) values ('  SQUAT TEST ')$$,
                 '23505', null, 'la bibliothèque refuse un exercice déjà présent avec une autre casse');

select isnt_empty($$update public.profiles set position = 'Centre'
                    where id = '00000000-0000-0000-0000-00000000000b' returning 1$$,
                  'un admin peut modifier un profil');

select lives_ok($$insert into public.player_availability (player_id, status)
                  values ('00000000-0000-0000-0000-00000000000b', 'blessé')$$,
                'un admin déclare un joueur blessé');

select lives_ok($$insert into public.player_availability (player_id, status)
                  values ('00000000-0000-0000-0000-00000000000a', 'apte')$$,
                'un admin déclare un joueur apte');

-- ---------- Joueur A : disponibilité et suppression ----------
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select is_empty($$select 1 from public.player_availability where player_id = '00000000-0000-0000-0000-00000000000b'$$,
                'A ne voit pas le statut blessé de B');
select isnt_empty($$select 1 from public.player_availability where player_id = '00000000-0000-0000-0000-00000000000a'$$,
                  'A voit son propre statut');
select is_empty($$update public.player_availability set status = 'blessé'
                  where player_id = '00000000-0000-0000-0000-00000000000a' returning 1$$,
                'A ne peut pas modifier son statut');
select throws_ok($$insert into public.player_availability (player_id, status)
                   values ('00000000-0000-0000-0000-00000000000c', 'blessé')$$,
                 '42501', null, 'A ne peut pas écrire dans player_availability');
select is_empty($$delete from public.session_logs
                  where player_id = '00000000-0000-0000-0000-00000000000a' and validated_at is not null returning 1$$,
                'A ne peut pas supprimer une séance validée');
select throws_ok($$select public.save_muscu_exercises('00000000-0000-0000-0000-0000000000a1',
                   '[{"id":"00000000-0000-0000-0000-0000000000f2","exercise_id":"00000000-0000-0000-0000-0000000000e1"}]')$$,
                 '42501', null, 'un joueur ne peut pas programmer sa séance');
select throws_ok($$select public.duplicate_week('00000000-0000-0000-0000-000000000002', '2030-01-07', '2030-01-14')$$,
                 '42501', null, 'un joueur ne peut pas dupliquer une semaine');

-- ---------- Visiteur non connecté ----------
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select 1 from public.wellness_entries$$, '42501', null, 'un visiteur non connecté n''a aucun accès aux données');

select * from finish();
rollback;

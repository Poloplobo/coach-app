-- Lancer : npx supabase test db --db-url "<chaîne de connexion du projet dev>"
-- Un joueur ne doit jamais voir ni écrire les données d'un autre joueur, ni modifier une saisie verrouillée.
-- Utilisateurs : A et B joueurs, C coach, M admin.
begin;
create extension if not exists pgtap with schema extensions;
select plan(153);

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

-- Séance de muscu d'hier pour B (rattrapage après relance, 0025)
insert into public.planned_sessions (id, session_date, title, player_id, activity_type_id) values
  ('00000000-0000-0000-0000-0000000000b9', public.paris_today() - 1, 'Muscu B hier', '00000000-0000-0000-0000-00000000000b', (select id from public.activity_types where name = 'Musculation'));
insert into public.planned_exercises (id, planned_session_id, exercise_id, position) values
  ('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000e1', 1);


-- Validation automatique de la muscu (0029) : séance de A le 2030-03-04, un exercice noté RPE 7, un sans réponse
insert into public.planned_sessions (id, session_date, title, player_id, activity_type_id, planned_duration_min) values
  ('00000000-0000-0000-0000-0000000000a9', '2030-03-04', 'Muscu A auto', '00000000-0000-0000-0000-00000000000a', (select id from public.activity_types where name = 'Musculation'), 50);
insert into public.planned_exercises (id, planned_session_id, exercise_id, position) values
  ('00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-0000000000e1', 1),
  ('00000000-0000-0000-0000-0000000000fb', '00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-0000000000e1', 2);
insert into public.exercise_feedback (player_id, planned_exercise_id, status, rpe) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000fa', 'fait', 7);

-- Duplication (étape 8) : semaine source du lundi 2030-01-07, cibles S90 (normale) et S91 (OFF)
insert into public.season_weeks (group_id, code, start_date, week_type_code, is_off) values
  ('00000000-0000-0000-0000-000000000002', 'S90', '2030-01-14', 'DEV', false),
  ('00000000-0000-0000-0000-000000000002', 'S91', '2030-01-21', 'DEV', true),
  ('00000000-0000-0000-0000-000000000002', 'S92', '2030-02-11', 'DEV', false);
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

-- Performance (étape 11) : un match joué (GPS de A et B, note staff de B) et un match à venir
insert into public.matches (id, group_id, match_date, opponent) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000002', public.paris_today() - 2, 'R92'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000002', public.paris_today() + 3, 'USON'),
  ('00000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-000000000002', public.paris_today() - 9, 'RCV');
insert into public.gps_records (match_id, player_id, position, minutes, distance_m, hi_distance_m, accelerations, vmax) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000b', 'PILIER', 60, 4000, 20, 12, 26),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'CENTRE', 70, 6000, 80, 30, 30);
insert into public.match_ratings (match_id, player_id, rater, color) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000b', 'staff', 'vert');

-- Photos des joueurs : le stockage n'est jamais public (vérifié hors RLS)
select is((select public from storage.buckets where id = 'player-photos'), false, 'le stockage des photos n''est pas public');

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
select is(public.duplicate_week('00000000-0000-0000-0000-000000000002', '2030-01-07', '2030-02-11', '{}', false) - 'skipped',
          '{"group": 0, "individual": 1}'::jsonb, 'option « séances individuelles seulement » : le planning du groupe n''est pas copié');
select throws_ok($$select public.duplicate_week('00000000-0000-0000-0000-000000000002', '2030-01-07', '2030-01-28')$$,
                 'P0002', null, 'une semaine absente du calendrier ne peut pas être remplie');
select is((select count(*)::int from public.planned_sessions where session_date = '2030-01-16'
           and player_id = '00000000-0000-0000-0000-00000000000a'),
          0, 'la séance d''un joueur hors du groupe n''est pas copiée');
select throws_ok($$select public.duplicate_week('00000000-0000-0000-0000-000000000002', '2030-01-07', '2030-01-14',
                   '{"00000000-0000-0000-0000-0000000000f4": "NaN"}')$$,
                 'P0001', null, 'une charge invalide est refusée');

-- Import d'une fiche musculation en début de cycle (étape 10)
select is(public.import_muscu_program('00000000-0000-0000-0000-00000000000b',
            '[{"date":"2030-02-04","exercises":[{"name":"squat TEST","block_label":"A1","sets":5,"reps":"5","load_value":100,"load_unit":"kg"},
                                                {"name":"Exercice importé test","block_label":"R1","reps":"30s"}]}]', '2026-2027',
            jsonb_build_array(jsonb_build_object('test_id', (select id from public.test_definitions order by name limit 1), 'value', 100, 'label', '1RM'))),
          '{"created": 1, "replaced": 0, "kept": 0, "past": 0, "targets": 1}'::jsonb,
          'le staff importe une séance et un objectif ; un exercice inconnu est créé');
select is((select count(*)::int from public.planned_exercises pe join public.planned_sessions ps on ps.id = pe.planned_session_id
           where ps.player_id = '00000000-0000-0000-0000-00000000000b' and ps.session_date = '2030-02-04'
             and pe.exercise_id = '00000000-0000-0000-0000-0000000000e1'), 1, 'l''exercice existant est reconnu sans tenir compte de la casse');
select is((public.import_muscu_program('00000000-0000-0000-0000-00000000000b',
            '[{"date":"2030-02-04","exercises":[{"name":"Squat test","block_label":"A1"}]}]', '2026-2027') ->> 'replaced')::int,
          1, 'réimporter remplace une séance sans retour du joueur');
select is(public.import_muscu_program('00000000-0000-0000-0000-00000000000b',
            jsonb_build_array(jsonb_build_object('date', public.paris_today(), 'exercises', '[]'::jsonb),
                              jsonb_build_object('date', public.paris_today() - 1, 'exercises', '[]'::jsonb)), '2026-2027'),
          '{"created": 0, "replaced": 0, "kept": 1, "past": 1, "targets": 0}'::jsonb,
          'une séance déjà renseignée par le joueur et un jour passé ne sont pas touchés');
select is((select done_load from public.exercise_feedback where planned_exercise_id = '00000000-0000-0000-0000-0000000000f1'),
          'secret B', 'le retour du joueur est conservé');
select lives_ok($$insert into public.planned_sessions (id, session_date, title, player_id, activity_type_id)
                  values ('00000000-0000-0000-0000-0000000000c4', '2030-02-06', 'Musculation', '00000000-0000-0000-0000-00000000000b',
                          (select id from public.activity_types where name = 'Musculation'));
                  insert into public.session_logs (player_id, planned_session_id, session_date, activity_type_id, duration_min, rpe, source)
                  values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c4', '2030-02-06',
                          (select id from public.activity_types where name = 'Musculation'), 60, 6, 'staff')$$,
                'préparation : RPE de séance déclaré sans retour d''exercice');
select is((public.import_muscu_program('00000000-0000-0000-0000-00000000000b',
            '[{"date":"2030-02-06","exercises":[{"name":"Squat test"}]}]', '2026-2027') ->> 'kept')::int,
          1, 'une séance dont le RPE est déclaré (sans retour d''exercice) n''est pas remplacée');
select throws_ok($$select public.import_muscu_program('00000000-0000-0000-0000-00000000000b',
                   '[{"date":"2030-02-05","exercises":[{"name":"Squat test","load_value":"NaN","load_unit":"kg"}]}]', '2026-2027')$$,
                 'P0001', null, 'une charge invalide est refusée à l''import');

select is(public.import_muscu_program('00000000-0000-0000-0000-00000000000b',
            '[{"date":"2030-02-11","exercises":[{"name":"Squat test","block_label":"A1","sets":3,"reps":"5"},
                                                {"name":"squat TEST","block_label":"B1","sets":2,"reps":"8"},
                                                {"name":"  ","block_label":"C1"}]}]', '2026-2027') ->> 'created',
          '1', 'un exercice présent deux fois dans la séance (casse différente) ne plante pas');
select is((select count(*)::int from public.planned_exercises pe join public.planned_sessions ps on ps.id = pe.planned_session_id
           where ps.player_id = '00000000-0000-0000-0000-00000000000b' and ps.session_date = '2030-02-11'),
          2, 'les deux occurrences sont gardées, le nom vide est ignoré');
select is((select count(*)::int from public.exercises where lower(trim(name)) = 'squat test'), 1, 'aucun doublon dans la bibliothèque');
select is(public.import_muscu_program('00000000-0000-0000-0000-00000000000b',
            '[{"date":"2030-02-18","exercises":[{"name":"Dup jour","block_label":"A1"}]},{"date":"2030-02-18","exercises":[{"name":"Dup jour","block_label":"A1"}]}]',
            '2026-2027'),
          '{"created": 1, "replaced": 1, "kept": 0, "past": 0, "targets": 0}'::jsonb, 'même date deux fois : la seconde remplace la première');

-- Bilan de cycle (étape 9) : lien test ↔ exercice saisi par le staff
select isnt_empty($$update public.test_definitions set exercise_id = '00000000-0000-0000-0000-0000000000e1'
                    where name = 'CMJ' returning 1$$, 'le staff lie un test à un exercice');

-- Performance : le staff note en tant que staff, jamais à la place du joueur
select throws_ok($$insert into public.match_ratings (match_id, player_id, rater, color)
                   values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'player', 'bleu')$$,
                 '42501', null, 'le staff ne peut pas écrire l''auto-évaluation d''un joueur');
select lives_ok($$insert into public.match_ratings (match_id, player_id, rater, color)
                  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'staff', 'jaune')$$,
                'le staff note un joueur');
select isnt_empty($$update public.match_ratings set minutes = 65 where rater = 'staff' and match_id = '00000000-0000-0000-0000-0000000000d1'
                    and player_id = '00000000-0000-0000-0000-00000000000a' returning 1$$, 'le staff saisit le temps de jeu');

-- Performance (revue) : le staff note aussi un match à venir et peut modifier le référentiel GPS
select lives_ok($$insert into public.match_ratings (match_id, player_id, rater, color)
                  values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000b', 'staff', 'rouge')$$, 'le staff pose une note sur un autre match de B');
select isnt_empty($$update public.gps_reference set ref_minutes = 70 where position_group = 'Pilier' returning 1$$,
                  'le staff peut modifier le référentiel GPS');

-- Import GPS en une transaction (0018) : un réimport retire la ligne d'un joueur absent du fichier corrigé
select is((public.import_match_gps('00000000-0000-0000-0000-000000000002', public.paris_today() - 2, 'R92', null,
            '[{"player_id":"00000000-0000-0000-0000-00000000000b","position":"pilier","minutes":60,"distance_m":4100,"hi_distance_m":20,"accelerations":12,"vmax":26.5}]')
           - 'match_id'), '{"rows": 1, "removed": 1}'::jsonb, 'le staff réimporte un match : ligne de B mise à jour, ligne de A (absente) retirée');
select is((select position from public.gps_records where player_id = '00000000-0000-0000-0000-00000000000b' and match_id = '00000000-0000-0000-0000-0000000000d1'),
          'PILIER', 'le poste est enregistré en majuscules');
select throws_ok($$select public.import_match_gps('00000000-0000-0000-0000-000000000002', public.paris_today() + 1, 'X', null, '[{"player_id":"00000000-0000-0000-0000-00000000000b"}]')$$,
                 'P0001', null, 'pas d''import GPS pour un match dans le futur');

-- Photos des joueurs (0019) : stockage privé, staff seulement
select lives_ok($$insert into storage.objects (bucket_id, name) values ('player-photos', '00000000-0000-0000-0000-00000000000b.png')$$,
                'le staff dépose la photo d''un joueur');

-- Consignes de notation (0020) : écrites par le staff, lues par les joueurs
select lives_ok($$insert into public.rating_guidelines (color, guideline) values ('bleu', 'Tu as dominé ton vis-à-vis')
                  on conflict (color) do update set guideline = excluded.guideline$$, 'le staff écrit la consigne d''une couleur');

-- Suppression d'une séance de musculation (0022)
select throws_ok($$select public.delete_muscu_session('00000000-0000-0000-0000-0000000000b1')$$, 'P0001', null,
                 'une séance où le joueur a répondu ne se supprime pas');
select lives_ok($$select public.delete_muscu_session('00000000-0000-0000-0000-0000000000c3')$$, 'le staff supprime une séance à venir sans retour');
select is_empty($$select 1 from public.planned_sessions where id = '00000000-0000-0000-0000-0000000000c3'$$, 'la séance et ses exercices sont supprimés');

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
select throws_ok($$select public.import_muscu_program('00000000-0000-0000-0000-00000000000a', '[]', '2026-2027')$$,
                 '42501', null, 'un joueur ne peut pas importer de programme');
select is_empty($$update public.test_definitions set exercise_id = null where name = 'CMJ' returning 1$$,
                'un joueur ne peut pas modifier le lien test ↔ exercice');

-- Performance (revue) : joueur A
select is_empty($$update public.gps_reference set distance_m = 1 returning 1$$, 'A ne peut pas modifier le référentiel GPS');
select is_empty($$select 1 from public.match_ratings where rater = 'staff'$$, 'A, pas encore noté, ne voit aucune note du staff');
select throws_ok($$insert into public.matches (group_id, match_date, opponent)
                   values ('00000000-0000-0000-0000-000000000002', current_date, 'X')$$, '42501', null, 'A ne peut pas créer de match');
select is_empty($$update public.gps_records set minutes = 10 where player_id = '00000000-0000-0000-0000-00000000000a' returning 1$$, 'A ne peut pas modifier son GPS');
select is(public.has_rated('00000000-0000-0000-0000-0000000000d1'), false, 'has_rated est faux pour A avant sa note');
select throws_ok($$insert into public.match_ratings (match_id, player_id, rater, color) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'player', 'vert')$$,
                 '42501', null, 'A ne peut pas noter un match d''un groupe dont il n''est pas membre');
select is_empty($$select 1 from public.match_ratings where rater = 'staff'$$, 'sans note de sa part, A ne voit aucune note staff (ni la sienne ni celles de B)');

-- ---------- Joueur B : performance ----------
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.gps_records), 1, 'B ne voit que ses propres GPS');
select is_empty($$select 1 from public.match_ratings where rater = 'staff'$$, 'B ne voit pas la note du staff tant qu''il ne s''est pas noté');
select throws_ok($$insert into public.match_ratings (match_id, player_id, rater, color)
                   values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000b', 'player', 'bleu')$$,
                 '42501', null, 'B ne peut pas noter un match pas encore joué');
select throws_ok($$insert into public.match_ratings (match_id, player_id, rater, color)
                   values ('00000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-00000000000b', 'player', 'vert')$$,
                 '42501', null, 'B ne note que le match du week-end (le dernier joué), pas un ancien match');
select throws_ok($$insert into public.match_ratings (match_id, player_id, rater, color)
                   values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000b', 'staff', 'bleu')$$,
                 '42501', null, 'B ne peut pas écrire une note staff');
select throws_ok($$insert into public.match_ratings (match_id, player_id, rater, color, minutes)
                   values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000b', 'player', 'jaune', 70)$$,
                 '23514', null, 'B ne saisit pas son temps de jeu (réservé au coach)');
select lives_ok($$insert into public.match_ratings (match_id, player_id, rater, color)
                  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000b', 'player', 'jaune')$$,
                'B note son match');
select is((select color from public.match_ratings where rater = 'staff'), 'vert', 'une fois noté, B découvre la note du staff');
select is_empty($$update public.match_ratings set color = 'vert' where player_id = '00000000-0000-0000-0000-00000000000b' and rater = 'player' returning 1$$,
                'note figée : B ne peut plus changer sa couleur après avoir vu la note du staff');
select throws_ok($$insert into public.gps_records (match_id, player_id, position, minutes, distance_m, hi_distance_m, accelerations)
                   values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000b', 'PILIER', 70, 9000, 500, 50)$$,
                 '42501', null, 'B ne peut pas écrire de GPS');
select is_empty($$select 1 from public.match_ratings where player_id = '00000000-0000-0000-0000-00000000000a'$$, 'B ne voit pas les notes de A');

-- Performance (revue) : B, déjà noté sur d1, essaie de détourner sa note
savepoint move_rating;
select is_empty($$update public.match_ratings set match_id = '00000000-0000-0000-0000-0000000000d2' where player_id = '00000000-0000-0000-0000-00000000000b' and rater = 'player' returning 1$$, 'B ne peut pas déplacer sa note vers un match pas encore joué');
rollback to savepoint move_rating;
savepoint steal_rating;
select is_empty($$update public.match_ratings set player_id = '00000000-0000-0000-0000-00000000000a' where player_id = '00000000-0000-0000-0000-00000000000b' and rater = 'player' returning 1$$, 'B ne peut pas réattribuer sa note à A');
rollback to savepoint steal_rating;
select is_empty($$delete from public.match_ratings where rater = 'player' returning 1$$, 'B ne peut pas supprimer sa note');
select is_empty($$delete from public.match_ratings where rater = 'staff' returning 1$$, 'B ne peut pas supprimer une note staff');
select is_empty($$update public.match_ratings set color = 'bleu' where rater = 'staff' returning 1$$, 'B ne peut pas modifier une note staff');
select is(public.has_rated('00000000-0000-0000-0000-0000000000d1'), true, 'has_rated vrai pour B sur d1');
select is(public.has_rated('00000000-0000-0000-0000-0000000000d2'), false, 'has_rated faux pour B sur d2');
select is_empty($$select 1 from public.match_ratings where match_id = '00000000-0000-0000-0000-0000000000d2'$$, 'B noté sur d1 ne lit pas la note staff de d2');
select throws_ok($$insert into public.match_ratings (match_id, player_id, rater, color) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'player', 'bleu')$$,
                 '42501', null, 'B ne peut pas noter à la place de A');
select is_empty($$update public.gps_reference set distance_m = 1 returning 1$$, 'B ne peut pas modifier le référentiel GPS');
select is_empty($$update public.gps_positions set position_group = 'Centre' returning 1$$, 'B ne peut pas modifier la table des postes');

select throws_ok($$select public.import_match_gps('00000000-0000-0000-0000-000000000002', public.paris_today() - 2, 'R92', null, '[]')$$,
                 '42501', null, 'un joueur ne peut pas importer de GPS');

select is_empty($$select 1 from storage.objects where bucket_id = 'player-photos'$$, 'un joueur ne voit aucune photo, même la sienne');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('player-photos', 'x.png')$$, '42501', null, 'un joueur ne peut pas déposer de photo');

select isnt_empty($$select 1 from public.rating_guidelines where color = 'bleu'$$, 'un joueur lit les consignes de notation');
select throws_ok($$insert into public.rating_guidelines (color, guideline) values ('rouge', 'x')$$, '42501', null, 'un joueur ne peut pas écrire de consigne');

select throws_ok($$select public.delete_muscu_session('00000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'un joueur ne peut pas supprimer de séance');

-- RPE visés (0031) : lisibles par tous les connectés, modifiables par le staff seulement
select lives_ok($$select 1 from public.week_type_rpe limit 1$$, 'B lit les RPE visés');
select throws_ok($$insert into public.week_type_rpe (week_type_code, activity_type_id, rpe_min, rpe_max)
                   values ('COMP', (select id from public.activity_types where name = 'Vidéo'), 8, 9)$$, '42501', null, 'B ne peut pas fixer un RPE visé');

-- Relance (0025) : sans relance, B ne rattrape pas hier ; il ne se relance pas lui-même
select throws_ok($$insert into public.session_logs (player_id, session_date, activity_type_id, duration_min, rpe)
                   values ('00000000-0000-0000-0000-00000000000b', public.paris_today() - 1, (select id from public.activity_types where name = 'Vidéo'), 25, null)$$,
                 '42501', null, 'sans relance, B ne déclare pas hier');
select throws_ok($$insert into public.exercise_feedback (player_id, planned_exercise_id, status)
                   values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000f9', 'fait')$$,
                 '42501', null, 'sans relance, B ne remplit pas la muscu d''hier');
select throws_ok($$insert into public.rpe_reminders (player_id, missing_date) values ('00000000-0000-0000-0000-00000000000b', public.paris_today() - 1)$$,
                 '42501', null, 'B ne peut pas se relancer lui-même');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.rpe_reminders (player_id, missing_date) values
                  ('00000000-0000-0000-0000-00000000000b', public.paris_today() - 1),
                  ('00000000-0000-0000-0000-00000000000b', public.paris_today() - 2),
                  ('00000000-0000-0000-0000-00000000000a', public.paris_today() - 1)$$, 'le coach relance des joueurs');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.session_logs (player_id, session_date, activity_type_id, duration_min, rpe)
                  values ('00000000-0000-0000-0000-00000000000b', public.paris_today() - 1, (select id from public.activity_types where name = 'Vidéo'), 25, null)$$,
                'relancé, B déclare une activité d''hier');
select lives_ok($$insert into public.exercise_feedback (player_id, planned_exercise_id, status)
                  values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000f9', 'fait')$$,
                'relancé, B remplit la muscu d''hier');
select throws_ok($$insert into public.session_logs (player_id, session_date, activity_type_id, duration_min, rpe)
                   values ('00000000-0000-0000-0000-00000000000b', public.paris_today() - 2, (select id from public.activity_types where name = 'Vidéo'), 25, null)$$,
                 '42501', null, 'même relancé, B ne déclare pas avant-hier');
select is((select count(*)::int from public.rpe_reminders), 2, 'B voit ses relances, pas celle de A');
select is_empty($$delete from public.rpe_reminders returning 1$$, 'B ne supprime pas ses relances');

-- Rappel du matin (0026) : chacun ses abonnements ; le staff ne voit que qui l'a activé ; l'envoi est réservé à la base
select lives_ok($$insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://fcm.googleapis.com/fcm/send/test-b', repeat('k', 40), repeat('a', 16))$$,
                'B active le rappel sur son téléphone');
select throws_ok($$insert into public.push_subscriptions (endpoint, player_id, p256dh, auth) values ('https://fcm.googleapis.com/fcm/send/test-x', '00000000-0000-0000-0000-00000000000a', repeat('k', 40), repeat('a', 16))$$,
                 '42501', null, 'B ne peut pas abonner A');
select throws_ok($$insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://exemple.fr/espion', repeat('k', 40), repeat('a', 16))$$,
                 '23514', null, 'adresse hors services de notification refusée');
select throws_ok($$insert into public.push_subscriptions (endpoint, p256dh, auth)
                   select 'https://fcm.googleapis.com/fcm/send/lot-' || i, repeat('k', 40), repeat('a', 16) from generate_series(1, 5) i$$,
                 'P0001', null, 'au plus 5 téléphones par joueur');
select throws_ok($$select public.push_enabled_players()$$, '42501', null, 'un joueur ne voit pas qui a activé le rappel');
select throws_ok($$select public.send_wellness_reminders()$$, '42501', null, 'un joueur ne déclenche pas l''envoi');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.push_subscriptions$$, 'A ne voit pas l''abonnement de B');
select is_empty($$delete from public.push_subscriptions returning 1$$, 'A ne supprime pas l''abonnement de B');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.push_subscriptions$$, 'le coach ne lit pas les adresses d''abonnement');
select ok('00000000-0000-0000-0000-00000000000b' in (select public.push_enabled_players()), 'le coach voit que B a activé le rappel');

-- Validation automatique de la muscu (0029) : un joueur ne la déclenche pas ; la base valide avec la moyenne des RPE
select throws_ok($$select public.auto_validate_muscu('2030-03-04')$$, '42501', null, 'un utilisateur de l''app ne déclenche pas la validation automatique');
reset role;
select is(public.auto_validate_muscu('2030-03-04'), 1, 'séance remplie non validée : validée automatiquement');
select is((select rpe::text || ' x ' || duration_min || ' ' || source from public.session_logs where planned_session_id = '00000000-0000-0000-0000-0000000000a9' and validated_at is not null),
          '7.0 x 50 auto', 'RPE moyen des exercices × durée prévue, origine « auto »');
select is((select status from public.exercise_feedback where planned_exercise_id = '00000000-0000-0000-0000-0000000000fb'), 'non fait', 'exercice sans réponse noté « non fait »');
select is(public.auto_validate_muscu('2030-03-04'), 0, 'deuxième passage : rien à refaire');

-- ---------- Visiteur non connecté ----------
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select 1 from public.wellness_entries$$, '42501', null, 'un visiteur non connecté n''a aucun accès aux données');
select throws_ok($$select 1 from public.matches$$, '42501', null, 'anonyme : matches inaccessible');
select throws_ok($$select 1 from public.gps_reference$$, '42501', null, 'anonyme : gps_reference inaccessible');
select throws_ok($$select 1 from public.gps_positions$$, '42501', null, 'anonyme : gps_positions inaccessible');
select throws_ok($$select 1 from public.gps_records$$, '42501', null, 'anonyme : gps_records inaccessible');
select throws_ok($$select 1 from public.match_ratings$$, '42501', null, 'anonyme : match_ratings inaccessible');

select * from finish();
rollback;

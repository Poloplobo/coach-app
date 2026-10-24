# Feuille de route — Rugby Tracker V1

**Objectif V1** : les joueurs saisissent tout dans l'app (wellness quotidien, RPE par activité, retours par exercice
de musculation) et le staff voit tout dans un tableau de bord. L'app remplace Google Forms + Sheets. Pas d'export.

**Règles** : une étape à la fois ; l'agent `testeur` valide chaque étape (critère « Validation ») avant la suivante ;
toute décision sur le contenu de l'app ou la sécurité des données des joueurs est soumise à l'utilisateur.

**Base de test** : projet Supabase de dev séparé (Londres, pas de Docker), alimenté avec les vraies données des classeurs (D3).
**Mise en production** après l'étape 5 (voir le jalon), pour arrêter le Google Form au plus vite.
**Ordre décidé le 24/10/2026** : relecture reviewer → mise en ligne Vercel → étape 7 (tableau de bord staff) → étape 6.
La programmation passe par les classeurs + `npm run import:prod` en attendant l'étape 6.

---

## Étape 1 — Base de dev et migration 0005
- `npx supabase init`, `npx supabase link` vers le projet dev, `npx supabase db push` (0001 → 0005).
- `0005_v1.sql` :
  - clés uniques pour un import idempotent : `planned_sessions (session_date, group_id, player_id, activity_type_id, title)`
    en `nulls not distinct`, `planned_exercises (planned_session_id, position)`,
    `session_logs (player_id, session_date, activity_type_id)` (une seule muscu par jour) ;
  - **wellness sur 30** (migration 0009) : `score` = somme des 6 items (6 à 30) ;
  - **verrouillage** : `session_logs.validated_at` ; le joueur modifie ses saisies (wellness, RPE, retours d'exercice)
    seulement le jour même (date de Paris) et tant que la séance n'est pas validée ; ensuite, seul le staff corrige ;
  - **statut blessé / apte** : table `player_availability` (statut, depuis le, note) ; écrite **par les admins seulement**
    (fonction `is_admin()`), lue par le joueur concerné et le staff ;
  - activités ajoutées : Membres sains, Réhabilitation, Reprise terrain (Kiné & Soins existe déjà) ;
  - RLS `session_logs` : le joueur n'écrit que ses lignes avec `source = 'app'` ; le staff écrit tout ;
  - RLS `exercise_feedback` : le joueur n'écrit que sur un `planned_exercise_id` qu'il peut voir.
- Types : `npx supabase gen types typescript --linked > src/lib/database.types.ts`.
- Tests ajoutés à `supabase/tests/rls_test.sql` : le staff lit tout ; joueur refusé sur `source = 'staff'`, sur un
  feedback d'une séance d'un autre, sur un doublon, sur la modification d'une séance validée ou d'un jour passé ;
  un coach ne peut pas changer le statut blessé, un admin oui.
- **Validation** : `npx supabase test db --db-url <url dev>` tout vert (secours : `psql "<url dev>" -f supabase/tests/rls_test.sql`) ;
  aucune migration en attente.

## Étape 2 — Comptes joueurs et import de `data/import/`
- **Comptes** : `scripts/create-accounts.ts` lit la liste des joueurs (noms des dossiers du Drive, déposée dans
  `data/import/joueurs.csv`), crée chaque compte avec l'identifiant `prenom.nom` (adresse interne
  `prenom.nom@joueurs.rnr`), un mot de passe provisoire, le profil et `import_name` (« NOM Prénom »).
  Il produit `data/import/identifiants.csv` à distribuer. Il utilise la clé secrète Supabase, lue dans `.env.local`
  sur le Mac de l'admin uniquement : jamais dans l'app, jamais dans une variable `VITE_`. Relançable sans doublon.
- **Import** `npm run import -- [--dry-run]` (`data/import/` dans le `.gitignore`) :
  - `charge-per.xlsx` : CONFIG_SEMAINES_PER → `season_weeks` + `cycles` (S1 = lundi 14/09/2026, une semaine par code ;
    type DEV/COMP/REG tel que saisi, modifiable à l'étape 6) ; PLANNING_CHARGES → groupe « PER 2026/27 » + postes ;
  - `rpe_historique.json` (préparé depuis BASE_REPONSES_SRPE_*, voir `A_VERIFIER_RPE.md`) → `session_logs`
    (`source = 'import_form'`, validées), **réponses au statut `ok` uniquement** ;
  - `muscu/*.xlsx`, onglets C<cycle>S<semaine> (S = numéro de semaine de saison) → `planned_sessions` du joueur
    + `planned_exercises` + `exercise_feedback` ; le RPE muscu du jour est rattaché à la séance (verrouillage) ;
  - `tests-per.csv` (joueurs PER extraits de « TESTING COMPLET - CRABOS 2026/27 », onglet Saisie)
    → `test_results` + `body_measurements`, datés du 14/09/2026 (P1 non daté). Migration `0006` : DC 3RM, FS 1RM, DM 3RM, K-Push.
- `scripts/import/` : `index.ts`, parseurs purs `parseChargePer.ts`, `parseRpe.ts` (zod), `parseMuscu.ts`, `parseTests.ts`.
- Joueurs rattachés par nom normalisé (ordre, accents, tirets) ; nom inconnu = ligne rejetée et listée.
  Alias (orthographes différentes d'un même joueur) : `data/import/alias.csv`, « nom dans le classeur;nom du compte ».
- L'import utilise la clé secrète, comme `create-accounts` (Mac de l'admin uniquement).
- Contrôle : sRPE en base par joueur et par semaine = « Total sRPE Séance (UA) » du formulaire, sinon échec.
- **Semaine type** : PLANNING_CHARGES (hors musculation, qui est individuelle) devient les séances du groupe de chaque
  semaine en cours ou à venir de CONFIG_SEMAINES_PER ; une semaine « (OFF) » = pas d'entraînement collectif, rien
  n'est généré (et ce qui l'était est supprimé). Le staff prépare ses semaines à l'avance dans CONFIG puis relance l'import.
- Plages de charge du staff : REG 500-1500, COMP 1500-2500, DEV > 2500 UA (migration `0007`).
- **Objectifs** : `data/import/objectifs.xlsx` (onglet « OBJECTIFS » ou le premier), colonnes Joueur | Test | Objectif | Libellé
  (facultatif) ; Test = nom exact d'un test du référentiel → `player_targets` de la saison.
- Non importé : SYNTHÈSE_CYCLES, MOBILITÉ/REHAB, Planification individuelle PER, SUIVI VITESSE.
- **Validation** : Vitest des parseurs sur des classeurs fictifs (reps `30''` / `6/côté`, RPE vide, nom inconnu,
  cellule fusionnée) ; sur le projet dev : `--dry-run` n'écrit rien, un second passage (comptes et import)
  ne crée rien, totaux sRPE égaux.

## Étape 3 — Socle front, connexion et rôles
- Vite + React 19 + TS strict + Tailwind (tokens de la charte), react-router, React Query, zod, Vitest + Testing Library.
- `src/lib/supabaseClient.ts` ; `src/features/auth/` : `useSession`, `useProfile`, `LoginPage`
  (identifiant + mot de passe ; mot de passe oublié → « demande à un admin »), `RequireRole`.
- Routage : joueur → `/joueur`, coach/admin → `/staff` ; profil absent → « Compte non activé, contacte le staff ».
- **Validation** : tests du garde de rôle ; `npm run build` et `npm run lint` sans erreur ; connexion manuelle
  d'un joueur et d'un staff fictifs ; aucun PIN, nom de joueur ou clé secrète dans le code.

## Étape 4 — Saisie joueur : wellness et RPE par activité (mobile)
- **Onglets joueur** (mobile, barre du bas) : Accueil (fatigue, semaine, muscu, à venir, objectifs) · Séance (musculation) ·
  Rugby (activités du jour, RPE + durée) · Forme (état de forme obligatoire + silhouette) · Réglages (compte, mode sombre,
  mot de passe, notice RGPD, déconnexion).
- `features/wellness/` : 6 questions 1-5 (5 = meilleur), score sur 30, modifiable toute la journée ; obligatoire avant les autres onglets.
- `features/rpe/` : activités du jour, RPE 0-10 + durée préremplie, pas de RPE si `requires_rpe` est faux ;
  saisie d'une activité libre s'il n'y a rien de planifié.
- **Joueur blessé** : il ne voit pas les séances du groupe, seulement ses séances individuelles
  (membres sains, réhab, reprise terrain, kiné).
- Accueil joueur : wellness fait / à faire, activités du jour, charge de la semaine ; historique 7 jours.
- `src/lib/week.ts` : date locale Europe/Paris envoyée par le client (le `current_date` de la base est en UTC).
- **Validation** : Vitest de `week.ts` (dimanche 23 h 30, lundi 0 h 30 à Paris) ; tests des hooks ; parcours mobile :
  wellness saisi deux fois = une seule ligne ; 2 activités dont une Vidéo (0 UA, durée comptée) ;
  un joueur blessé ne voit plus les séances du groupe.

## Étape 5 — Séance de musculation et objectifs côté joueur
- `features/seances/` : programme de musculation individuel de la semaine, en blocs (MOB, A1, B1, F) ; par exercice : statut, charge réalisée
  (texte), RPE, commentaire → `exercise_feedback`. Modifiable toute la journée ; « Valider la séance » crée le
  `session_logs` Musculation et verrouille la séance. Taux de complétion via `session_completion`.
- **Silhouette de fatigue** (`features/wellness/FatigueBody.tsx`) sous la forme du jour : fatigue % = (25 − score) / 20,
  zones colorées tête (sommeil, stress, humeur), corps (fatigue), muscles (douleurs), posture voûtée selon le %.
- `features/tests/` : « Mes objectifs » en lecture seule : pour chaque objectif chiffré, dernier résultat de test,
  cible et barre de progression.
- **Validation** : pgTAP (un joueur ne lit pas le feedback d'un autre, ne modifie plus une séance validée) ;
  Vitest (regroupement par bloc, ordre, % de progression vers l'objectif, y compris quand plus bas = mieux, ex. sprint) ;
  valider une séance importée : complétion affichée, sRPE muscu dans la charge hebdo.

## Jalon — Mise en production (après l'étape 5)
- Projet Supabase de production **dans l'UE (Paris eu-west-3 ou Francfort eu-central-1)** ; le projet dev est à Londres, inscription libre désactivée, migrations poussées, tests RLS verts.
- Comptes réels créés par le script de l'étape 2, import des vrais classeurs, identifiants distribués.
- Notice d'information aux joueurs (quelles données, qui les voit, combien de temps) : obligatoire au RGPD,
  même sans accord parental.
- Hébergement de l'app (à choisir à ce moment-là), fin du Google Form.

## Étape 6 — Programmation staff et gestion des joueurs (desktop)
- `features/staff/programming/` : grille de la semaine du groupe (activités rugby, vidéo…) ; programme de musculation
  **par joueur** (pas de séance de muscu collective) : éditeur d'exercices (bloc, séries, reps, `load_value` + `load_unit`,
  tempo, repos ; création d'exercice) ; calendrier `season_weeks` ;
  « Dupliquer la semaine sur la suivante » pour le groupe ou pour un joueur (idempotent grâce aux clés de 0005).
- Fiche joueur : statut **blessé / apte** (bouton visible et utilisable par les admins seulement) ;
  saisie des objectifs chiffrés (`player_targets`) et des résultats de tests.
- **Validation** : Vitest de `shiftWeek` ; pgTAP (un joueur ne peut pas planifier) ; dupliquer deux fois une semaine
  sans doublon, et le joueur la voit aux étapes 4 et 5 ; un coach ne voit pas le bouton blessé / apte.

## Étape 7 — Tableau de bord staff (desktop) — décisions du 24/10/2026
Trois vues (barre du haut) : **Aujourd'hui · Semaine · Joueur**, plus Réglages. Calculs purs dans `features/staff/load.ts`
(testés), lectures dans `features/staff/useStaff.ts`. Données de dev : joueurs fictifs (`scripts/seed-dev.ts`, dev uniquement).
- **Aujourd'hui** : pour chaque joueur, silhouette, % de fatigue, score /30, détail des 6 items, **alerte si total < 16/30
  ou un item à 1**, statut blessé/apte ; **relance des retardataires** (forme ou RPE non saisis) avec message prêt à copier.
- **Semaine** (calque de TABLEAU_DE_BORD) : charge moyenne / visée, % de la cible (« Accurate RPE »), statut par **plage**
  (REG 500-1500, COMP 1500-2500, DEV > 2500) ; synthèse jour par jour (déclarants, durée planifiée, dont rugby/muscu,
  sRPE moyen et cumulé, intensité UA/min) ; **matrice individuelle** (séances, sRPE par jour, total, visé, %, écart, écart
  vs groupe, statut) ; répartition par pilier vs cible ; anomalies ; joueurs blessés exclus des alertes de sous-charge.
- **Joueur** (calque de SUIVI_INDIVIDUEL) : indicateurs de la semaine, détail jour par jour (activités, minutes rugby /
  muscu / vidéo-kiné, RPE moyen, sRPE, moyenne du groupe, écart), journal des déclarations, courbes de la saison
  (forme et sRPE, Recharts), complétion muscu, objectifs et tests ; **ratio aigu/chronique** (admins seulement :
  7 j / moyenne hebdo 28 j ; < 0,8 et 1,3-1,5 jaune, 0,8-1,3 vert, > 1,5 rouge) ; **bouton blessé / apte** (admins) ;
  **correction des saisies** d'un jour passé par le staff (RPE, durée, état de forme ; `source = 'staff'`).
- Limite connue (E6) : la relance « RPE d'hier » suppose que les séances de groupe concernent tous les joueurs aptes ;
  à lier aux membres du groupe quand il y aura plusieurs groupes.
- **Export Excel** de la semaine : onglet « Collectif » (TABLEAU_DE_BORD) + un onglet par joueur (SUIVI_INDIVIDUEL),
  fichier `PER_<code semaine>_<lundi>.xlsx`, à ranger soi-même sur le Drive.
- **Validation** : Vitest des calculs (statut aux bornes des plages, %, matrice, synthèse, ratio, alerte, retardataires) ;
  pgTAP (un coach ne change pas le statut, le staff corrige une saisie avec `source = 'staff'`, un joueur ne voit rien
  d'autrui) ; parcours sur données fictives ; un coach ne voit ni le ratio ni le bouton blessé / apte.

---

## Décisions prises
- **D1** Connexion par identifiant `prenom.nom` + mot de passe, comptes créés en amont ; réinitialisation par un admin.
- **D2** Comptes créés par script sur le Mac de l'admin, à partir de la liste des joueurs du Drive.
- **D3** Projet dev avec les vraies données des classeurs (décision du 23/10/2026) ; mise en production après l'étape 5 ; pas d'accord parental requis.
- **D4** Score sur 30 (6 questions, courbatures haut et bas séparées) ; alerte si total < 16/30 ou un item à 1 ;
  le joueur voit son % de fatigue, pas le score.
- **D5** Saisies modifiables toute la journée ; une séance validée est verrouillée ; une séance de musculation par jour.
  La musculation est toujours individuelle (un programme par joueur) ; les activités rugby / vidéo sont planifiées pour le groupe.
- **D6** Statut blessé / apte géré par les admins ; un joueur blessé ne voit que son programme individuel
  (membres sains, réhab, reprise terrain, kiné).
- **D7** Ratio aigu/chronique visible des admins seulement.
- **D8** Objectifs et tests affichés sur l'accueil du joueur, en lecture seule.
- **D9** Identifiants envoyés en message privé à chaque joueur (jamais en groupe), mot de passe à changer dans Réglages.
- **D10** Après la mise en ligne, la base de dev (Londres) est vidée des vraies données ; elle ne garde que du fictif.

## Plus tard
Export CSV/PDF, imports SYNTHÈSE / MOBILITÉ / SUIVI VITESSE / Planification individuelle PER, PWA hors-ligne,
notifications de rappel wellness, import GPS.

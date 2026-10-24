# Rugby Tracker — Rouen Normandie Rugby (Crabos & Pôle Espoir)

Centre de suivi athlétique pour joueurs de rugby (16-18 ans) : séances individuelles et collectives,
RPE / charge, wellness (état de forme), tests physiques et progressions. Deux publics :
- **Joueur** (mobile, 30 secondes par jour) : voit ses séances, saisit ses résultats, son RPE et son wellness.
- **Staff** (préparateur physique, desktop) : programme les séances pour un groupe ou un joueur,
  suit la charge et la forme de l'effectif, exporte les données.

## Stack
- React 19 + Vite + TypeScript (strict) + Tailwind CSS
- Supabase : Postgres, Auth, Row Level Security, Storage. Région **UE** obligatoire.
- Recharts pour les graphiques
- À ajouter : react-router, @tanstack/react-query (accès données), zod (validation), vite-plugin-pwa
- Application web installable (PWA) : pas d'app native pour l'instant.

## Commandes
- `npm run dev` : serveur local
- `npm run build` : build de production (doit passer sans erreur TypeScript)
- `npm run lint` : ESLint
- `npm test` : Vitest
- `npx supabase db reset` : rejoue toutes les migrations en local
- `npm run test:db` : tests SQL (RLS) de supabase/tests sur le projet dev (sans Docker)
- `npm run accounts -- --dry-run` : crée les comptes joueurs de data/import/joueurs.csv (Mac de l'admin uniquement)
- Production (projet « RNR - Acacémie », Francfort) : mêmes commandes suffixées `:prod` (`test:db:prod`, `accounts:prod`,
  `import:prod`), qui lisent `.env.prod.local`. Migrations : `npx supabase db push --db-url` avec l'URL de production.
- L'import n'écrit qu'avec `-- --confirm=<référence du projet>` (sinon il s'arrête) et ne remplace jamais une saisie
  de joueur existante (RPE, retours d'exercice). Mot de passe oublié : `npm run reset-password:prod -- prenom.nom`.
- `npx supabase gen types typescript --linked > src/lib/database.types.ts` : à relancer après chaque migration

## Architecture
```
src/
  lib/            supabaseClient.ts, database.types.ts (généré), utils (calculs de charge)
  features/
    auth/         connexion, session, garde de rôle
    seances/      séances planifiées, saisie des séries, validation
    rpe/          saisie RPE post-séance, charge hebdo
    wellness/     questionnaire quotidien, historique
    tests/        tests physiques P1/P2/P3, progressions
    staff/        tableau de bord effectif, programmation, exports
  components/ui/  composants génériques (Button, Card, Slider, Tabs…)
supabase/
  migrations/     SQL versionné — seule source de vérité du schéma
docs/             PLAN.md (feuille de route), décisions
```
Chaque feature contient ses composants, ses hooks (`useXxx.ts` avec React Query) et ses types.
Les composants n'appellent jamais `supabase` directement : ils passent par les hooks de leur feature.

## Modèle de données (voir supabase/migrations)
profiles · groups · group_members · exercises · planned_sessions · planned_exercises ·
session_logs · exercise_feedback · wellness_entries · test_definitions · test_results ·
activity_types · week_types · season_weeks · vues weekly_player_load / weekly_group_load.

Logique PER (reprise du classeur Google « CHARGE D'ENTRAINEMENT - PER ») :
- Une journée = plusieurs **activités** (Dév. Tactique, Musculation, Jeu au Poste, Vidéo, Collectif Total…).
  Chaque activité appartient à un **pilier** : rugby, physique, accompagnement, PPID.
- Planifié : une ligne `planned_sessions` = une activité d'un jour, pour un groupe **ou** un joueur (`group_id` xor `player_id`).
- Réalisé : une ligne `session_logs` = une activité déclarée avec son RPE. Vidéo, soins et récupération n'ont pas de RPE (0 UA mais du temps compté).
- sRPE = RPE (CR-10) × durée en minutes, calculé en base. Charge hebdo = somme des sRPE de la semaine.
- Chaque semaine de saison (S1, S2…) a un **type** DEV / COMP / REG avec volume cible et cible sRPE (3000 / 2000 / 1000 UA).
- Statut hebdo selon la plage du type : REG 500-1500, COMP 1500-2500, DEV > 2500 UA (sous la plage = sous-charge, au-dessus = surcharge),
  avec le % de la cible affiché pour la précision. Calculé dans la vue weekly_player_load (migration 0008).
- `profiles.import_name` (« NOM Prénom ») sert à rattacher l'historique du formulaire Google au bon joueur.

Suivi individuel (reprise des fiches « <Joueur> : PER MUSCULATION » et du doc « Planification individuelle PER ») :
- Chaque joueur PER a un **profil de saison** : type (VITESSE, ÉNERGÉTIQUE, FORCE/PUISSANCE, PHYSIQUE, MÊLÉE),
  objectif n°1, objectif santé (donnée sensible), pouvoir à développer, et des **objectifs chiffrés** (`player_targets`, ex. DC 100 kg 1RM).
- Programme muscu : une séance individuelle = `planned_sessions.player_id` + exercices organisés en **blocs**
  (`block_label` MOB, A1, A2, B1, C1, F), avec séries, reps (texte : '5', "30''", '6/côté', 'AMRAP'), charge (%RM, kg, PDC, libre), tempo ('4.0.1.0'), repos.
- Le joueur renvoie, par exercice : RPE, charge réalisée (texte « 2x125 1x120 »), statut (fait / partiel / non fait), commentaire → `exercise_feedback`.
- Les semaines sont nommées C<cycle>S<semaine> dans les fiches (C1S4). Les cycles (`cycles`) ont un focus et chaque joueur un bilan de cycle.
- Poids et taille sont historisés dans `body_measurements` (comparaison saison N-1 / N).
- Wellness (« état de forme ») : 6 items notés 1 à 5 — sommeil, fatigue, courbatures haut du corps, courbatures bas du corps,
  stress, humeur — **5 = meilleur état** pour tous (pas d'échelle inversée). Score sur 30 (migration 0009) ; obligatoire chaque
  jour (les onglets Accueil, Séance, Rugby restent verrouillés tant qu'il n'est pas rempli). Le joueur voit son % de fatigue,
  pas le score. Alerte staff : total < 16/30 ou un item à 1.

## Règles à ne jamais enfreindre
1. **Sécurité des données** : ce sont des données de santé de mineurs. Toute table a la RLS activée.
   Un joueur ne lit et n'écrit que ses propres lignes ; le staff lit tout. Jamais de clé `service_role` côté client.
2. Aucune donnée en dur dans les composants (pas de tableaux fictifs) : tout vient de Supabase.
3. Aucun identifiant ni PIN dans le code. Authentification uniquement via Supabase Auth.
4. Toute évolution du schéma = une nouvelle migration SQL, jamais d'édition manuelle en production.
5. Les dates sont stockées en `date` / `timestamptz` ; la semaine commence le lundi (ISO).
6. Interface en français. Code (variables, fonctions) en anglais.
7. Mobile first pour les écrans joueur ; desktop first pour les écrans staff.

## Charte graphique
Fond `#1A1A1A`, surfaces `#2A2A2A`, bordures `#3A3A3A`, rouge RNR `#C8102E`, or `#FFD700`, vert `#10b981`.
Utiliser les tokens Tailwind définis dans la config plutôt que des couleurs en dur dans le JSX.

## État du code
Refonte en cours selon docs/PLAN.md. L'ancienne app (« Desktop/Application /rugby-tracker ») sert seulement de référence
d'écrans : PIN en clair, données fictives et échelles wellness inversées, ne rien en reprendre.
Comptes : `npm run accounts` depuis `data/import/joueurs.csv` et `data/import/staff.csv` (jamais de création depuis l'app).

## Agents disponibles (.claude/agents)
- `architecte` : planifie une feature avant de coder (lecture seule).
- `data-supabase` : migrations, RLS, types générés, requêtes.
- `reviewer` : relit chaque changement (sécurité RLS, règles ci-dessus).
- `testeur` : écrit et lance les tests (calculs de charge, hooks, parcours clés).
Workflow conseillé : architecte → implémentation → data-supabase si schéma → testeur → reviewer.

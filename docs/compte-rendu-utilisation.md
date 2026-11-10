# Compte rendu d'utilisation : application de suivi du Pôle Espoir (Rouen Normandie Rugby)

Ce document décrit l'application telle qu'elle fonctionne au 10/11/2026. Il sert de matière pour deux présentations PowerPoint :
- **Présentation joueurs** : prise en main, routine quotidienne, horaires de rendu et attentes du staff.
- **Présentation staff** : utilisation des onglets et routine hebdomadaire.

La partie « Mode d'emploi » (section 4) peut être reprise en annexe de chacune.

Consignes pour la mise en forme :
- **Couleurs** du club : fond très sombre #1A1A1A, rouge RNR #C8102E, or #FFD700, vert #10b981.
- **Ton** : tutoiement pour les joueurs (16-18 ans), vouvoiement ou neutre pour le staff.
- **Volume** : une idée par diapositive, peu de texte.

---

## 1. L'application en bref

- **Adresse** : https://rugby-tracker-rnr.vercel.app.
- **Ce n'est pas une app à télécharger dans un store** : elle s'installe depuis le navigateur.
- **Objectif** : suivre au quotidien la forme, la charge d'entraînement, la musculation, les matchs, les tests physiques et le retour de blessure de chaque joueur du Pôle Espoir.
- **Deux espaces** :
  - **Joueur**, sur téléphone. Le principe : environ 30 secondes par jour.
  - **Staff**, sur ordinateur. Il sert à programmer, suivre et alerter.
- **Confidentialité** :
  - ce sont des données de santé de mineurs ;
  - un joueur ne voit que ses propres données ;
  - le staff voit l'effectif ;
  - le diagnostic médical, les actions du kiné et les commentaires du staff ne sont jamais visibles côté joueur.

---

## 2. Présentation JOUEURS

### 2.1 Installer l'application (une seule fois)

1. **Installer sur l'écran d'accueil** :
   - **iPhone** : ouvrir l'adresse dans **Safari**, toucher le bouton Partager, puis « Sur l'écran d'accueil ».
   - **Android** : ouvrir l'adresse dans **Chrome**, menu ⋮, puis « Installer l'application ».
2. **Se connecter** :
   - identifiant de la forme **prenom.nom** ;
   - mot de passe remis par le staff ;
   - il peut ensuite le changer lui-même dans Réglages › Changer mon mot de passe ;
   - en cas d'oubli, demander au staff, qui le réinitialise.
3. **Activer les notifications** dans Réglages (roue dentée en haut à droite). Sur iPhone, ça ne marche que si l'app est installée sur l'écran d'accueil.

### 2.2 La routine quotidienne et les horaires

| Quand | Quoi | Règle |
|---|---|---|
| **Chaque matin** | État de forme (onglet Forme) | **Obligatoire tous les jours.** Tant qu'il n'est pas rempli, les onglets Accueil, Séance et Rugby restent verrouillés. Rappel par notification à **8h**, puis à **10h** s'il manque. |
| **Après chaque entraînement**, le jour même | Effort ressenti (RPE) et durée de chaque activité (onglet Rugby) | **À déclarer à chaque entraînement.** Rappel à **20h** s'il en manque. Le lendemain, ce n'est plus possible, sauf si le staff relance. |
| **Pendant ou après la séance de musculation** | Retours exercice par exercice (onglet Séance) | Fait, partiel ou non fait, RPE de l'exercice, puis « Terminer la séance ». Une séance non terminée est validée automatiquement à **23h30**. |
| **Après chaque match** | Auto-évaluation (onglet Perf › Notes) | Choisir son coq **et écrire un commentaire** (au moins une phrase), obligatoire. La note du coach ne s'affiche qu'après la sienne. |

### 2.3 Les onglets côté joueur

- **Accueil** :
  - « Ta journée » : la liste de ce qu'il reste à faire aujourd'hui ;
  - les anneaux du jour : fatigue en %, charge de la semaine, séance de musculation faite en % ;
  - « Ma semaine », les séances à venir et le dernier match ;
  - pour un joueur blessé, la carte « Mon retour » en tête.
- **Séance (musculation)** :
  - la séance du jour, avec son intitulé (ex. « Puissance BDC ») ;
  - les blocs A, B, C… Un bloc de plusieurs exercices est un **enchaînement** : A1 → repos → A2 → repos, à répéter le nombre de tours indiqué ;
  - l'exercice « En cours » et le suivant sont signalés ;
  - un petit bonhomme blanc montre le mouvement ;
  - minuteur de repos intégré ;
  - charge conseillée calculée sur les derniers tests ;
  - **une séance manquée peut être refaite un autre jour de la même semaine**.
- **Rugby** :
  - les activités du jour : effort ressenti sur l'échelle RPE de 1 à 10 (feuille du staff) et durée ;
  - vidéo et soins : un simple « J'y étais » ;
  - si une activité prévue n'a pas été faite, toucher **« Je n'ai pas fait »** et donner la raison : malade ou douleur, absent (cours, rendez-vous), séance annulée ou modifiée, autre avec une précision. Ce n'est alors pas compté comme un oubli.
- **Perf**, en trois volets qu'on fait glisser :
  - **Notes** : la note de son match et celle du coach ;
  - **GPS** : le GPS du week-end comparé aux attendus de son poste, et ses 3 derniers matchs ;
  - **Tests** :
    - ses objectifs de la saison, avec ce qu'il reste à gagner et sa progression depuis septembre ;
    - ses **coqs FFR** (référentiel fédéral filière jeune, à son poste : bleu premium, vert très bon, jaune bon, rouge à améliorer), avec ce qui manque pour le coq suivant ;
    - ses **médailles** quand il est sur le podium du groupe (or, argent, bronze).
- **Forme** : le questionnaire du matin. 6 questions notées de 1 à 5 (sommeil, fatigue, courbatures haut du corps, courbatures bas du corps, stress, humeur) ; **5 = meilleur état** pour toutes. Le joueur voit sa fatigue en % et son évolution sur 7 jours.

### 2.4 Joueur blessé

- **Séances** : le joueur garde l'état de forme quotidien, mais n'a plus les séances du groupe. Il a ses séances de **réhabilitation** et de **membres sains** dans l'onglet Séance.
- **Douleur** : sur chaque exercice, il note sa **douleur de 0 à 10** (EVA).
- **Ajouts** : il ajoute lui-même son cardio (porté, course) et sa reprise terrain dans l'onglet Rugby.
- **Plan de retour** : sur son Accueil, « Mon retour » montre les phases, l'étape en cours, ses objectifs, le programme et ce qu'il faut réussir pour passer à la suite, avec une date de retour estimée.

### 2.5 Ce que le staff attend des joueurs (diapositive « Nos attentes »)

1. L'état de forme **chaque matin**, avant 10h.
2. Le RPE **après chaque entraînement**, le jour même, honnêtement (pas de RPE « par défaut »).
3. Les retours de musculation **exercice par exercice**, puis « Terminer la séance ».
4. « Je n'ai pas fait » quand une activité prévue n'a pas eu lieu, plutôt que de laisser vide.
5. L'auto-évaluation de chaque match, **avec un vrai commentaire**.
6. Pour un blessé : la douleur notée sur chaque exercice de réhab.
7. Les notifications activées.

Le staff voit les oublis : liste des RPE non déclarés, taux de déclaration de la saison par joueur, relances.

---

## 3. Présentation STAFF

### 3.1 Accès et comptes

- **Connexion** par e-mail et mot de passe. Les comptes sont créés par l'admin, jamais depuis l'app.
- **Rôles** :
  - **admin** : déclarer un joueur blessé ou apte, voir le ratio aigu/chronique ;
  - **coach** : tout le reste.
- **Navigation** : sur ordinateur, une barre latérale d'icônes qui s'ouvre au survol. Sur téléphone, le bouton ☰.
- **Compte joueur.test** : il sert à voir l'interface joueur. Il est en lecture seule et n'apparaît dans aucune liste ni aucun chiffre.

### 3.2 Les onglets staff

- **Aujourd'hui** :
  - la forme du jour de l'effectif ;
  - les **alertes** : score de forme inférieur à 16/30, ou un item à 1 ;
  - « À relancer » : forme du jour ou RPE d'hier manquants, avec un message à copier ou une relance qui débloque la saisie de la veille ;
  - « RPE non déclarés » sur les 7 derniers jours, et la liste à part « Déclarées non faites », avec la raison ;
  - la charge et le rythme de la semaine.
- **Semaine** :
  - charge de chaque joueur (sRPE = RPE × minutes) et statut selon le type de semaine : **REG 500-1500 UA, COMP 1500-2500 UA, DEV plus de 2500 UA** ;
  - RPE moyen comparé au RPE visé ;
  - « À surveiller » ;
  - exports PowerPoint et Excel ;
  - les joueurs blessés n'y figurent pas, ils sont suivis dans Médical.
- **Joueur** : la fiche individuelle, avec :
  - la charge et le taux de déclaration des RPE sur la saison ;
  - le ratio aigu/chronique (admin), calculé sur les 4 jours d'entraînement : lundi, mardi, mercredi, vendredi ;
  - les tests et objectifs ;
  - la gestion (déclarer blessé, admin).
- **Musculation** : les séances de la semaine et les retours des joueurs, exercice par exercice, et le bilan de cycle.
- **Programmation** :
  - **Semaines et duplication** :
    - le calendrier de la saison : type DEV, COMP ou REG, cycle ;
    - la copie d'une semaine sur la suivante, avec les charges qui progressent : **+2,5 %** si validée avec un RPE inférieur à 5, **+1,25 %** si RPE de 5 ou plus, **−2,5 %** si non validée avec un RPE de 7 ou plus ;
    - les options « Musculation seulement » et « Charges identiques » ;
    - une alerte si le planning copié dépasse la plage de la semaine cible.
  - **Planning du groupe** : les activités de chaque jour, avec la durée et le RPE visé. La charge prévue est comparée à la cible.
  - **Séance de musculation** : modifier la séance d'un joueur, y compris son **intitulé**.
  - **Import d'un cycle** :
    - les fiches Excel « Prénom NOM_PER MUSCULATION » ;
    - l'intitulé est lu sur la ligne du jour (« Lundi - Puissance BDC ») ;
    - « Lundi RÉHAB : » ou « Lundi MEMBRES SAINS : » pour les blessés ;
    - aperçu avant import, avec une alerte si la fiche d'un blessé partirait en musculation.
  - **RPE visés et seuils de charge** : la fourchette de RPE par activité et par type de semaine.
- **Performance** :
  - **GPS** : importer les GPS d'un match, avec le tableau et les rapports.
  - **Match** : noter un match (coq, temps de jeu, commentaire), consignes de notation, notes d'un joueur sur l'année.
  - **Test** :
    - « Tests et coqs du groupe » : un tableau joueurs × tests, avec les coqs FFR à leur poste et le podium du groupe ;
    - import des maxi et objectifs ;
    - le barème FFR.
- **Médical** :
  - **Suivi du joueur blessé** : rapport depuis la blessure (séances de réhab et membres sains faites, cardio, reprise terrain, RPE et douleur moyenne par semaine), courbe de la douleur et du RPE, douleur par exercice ;
  - **Plan de retour** : la frise des étapes et la date de retour estimée ;
  - **Préparer le plan et les séances** : import du plan Excel, créateur de plan (phases, objectifs, actions prépa et kiné, critères), import des séances, fiche blessure (classement World Rugby / CIO) ;
  - **Épidémiologie** : incidence et gravité des blessures pour 1 000 h d'exposition, sur la saison ou un cycle.

### 3.3 Routine staff conseillée

- **Chaque matin** : onglet Aujourd'hui (alertes de forme, joueurs à relancer).
- **Chaque soir ou le lendemain** : RPE non déclarés, relancer si besoin.
- **En début de semaine** : Programmation (dupliquer la semaine, vérifier la charge prévue face à la cible, ajuster le planning du groupe).
- **En début de cycle** : importer les fiches de musculation (vérifier la « Semaine 1 du cycle » et les intitulés), mettre à jour les objectifs.
- **Après chaque match** : noter les joueurs, importer les GPS.
- **Après chaque session de tests** : importer les maxi, regarder les coqs du groupe.
- **Pour chaque blessé** : tenir à jour le plan de retour, valider les étapes, suivre la douleur.
- **Avant la fin de chaque cycle** : ajouter les semaines suivantes au calendrier. Sans semaine au calendrier, pas de charge visée ni de duplication.

---

## 4. Mode d'emploi express (fiches pratiques)

**Joueur : ma journée en 4 gestes**
1. Le matin : Forme, puis les 6 questions, puis « Enregistrer ».
2. Après l'entraînement : Rugby, puis le RPE et la durée de chaque activité. Si une activité n'a pas eu lieu : « Je n'ai pas fait » et la raison.
3. En musculation : Séance, puis Fait, Partiel ou Non fait pour chaque exercice avec son RPE, puis « Terminer la séance ».
4. Après un match : Perf › Notes, puis mon coq et mon commentaire, puis « Valider ma note ».

**Joueur : problèmes fréquents**
- **Onglets verrouillés** : l'état de forme du jour n'est pas rempli.
- **« Ce jour n'est plus modifiable »** : le délai est passé, demander au staff.
- **Pas de notification** : activer dans Réglages. Sur iPhone, l'app doit être installée sur l'écran d'accueil.
- **Mot de passe oublié** : le staff le réinitialise.

**Staff : gestes clés**
- Relancer un joueur : Aujourd'hui › À relancer.
- Dupliquer une semaine : Programmation › Semaines et duplication.
- Importer un cycle : Programmation › Import d'un cycle.
- Déclarer un blessé : fiche Joueur › Gestion (admin). Le joueur sort de la semaine du groupe, une fiche blessure et un plan de retour sont créés.
- Importer un plan de réhab : Médical › Préparer.
- Importer des tests : Performance › Test › Importer les maxi et objectifs.

---

## 5. Plans de diapositives proposés

**PowerPoint joueurs (10 à 12 diapositives)**
1. Titre : « Ton suivi au Pôle Espoir ».
2. Pourquoi cette app : progresser, prévenir les blessures, être suivi.
3. Installer l'app et se connecter.
4. Activer les notifications.
5. Ta journée : les horaires (tableau de la section 2.2).
6. L'état de forme : les 6 questions, 5 = meilleur.
7. Le RPE : l'échelle de 1 à 10, après chaque entraînement, et « Je n'ai pas fait ».
8. La séance de musculation : blocs, enchaînements, retours, « Terminer la séance ».
9. Perf : notes de match avec commentaire, GPS, tests, coqs et médailles.
10. Blessé : réhab, douleur, plan de retour.
11. Nos attentes (section 2.5).
12. Confidentialité, et qui contacter en cas de problème.

**PowerPoint staff (12 à 14 diapositives)**
1. Titre et objectifs.
2. Comptes et rôles.
3. Navigation.
4. Aujourd'hui.
5. Semaine (charge, statuts REG, COMP et DEV).
6. Fiche joueur.
7. Musculation.
8. Programmation, partie 1 : semaines, duplication et progression des charges.
9. Programmation, partie 2 : planning du groupe, RPE visés, import d'un cycle.
10. Performance : GPS, notes de match, tests et coqs FFR.
11. Médical : suivi, plan de retour, épidémiologie.
12. Routine hebdomadaire.
13. Confidentialité et compte de test.
14. Gestes clés.

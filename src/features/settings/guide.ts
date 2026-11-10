// Mode d'emploi affiché dans Réglages (décision du 10/11/2026), version joueur et version staff.
// Même contenu que docs/compte-rendu-utilisation.md : le mettre à jour ensemble quand une règle ou un horaire change.

export type GuideSection = { title: string; items: string[] }

export const PLAYER_GUIDE: GuideSection[] = [
  {
    title: 'Ta journée en 4 gestes',
    items: [
      "Le matin, avant 10h : Forme, réponds aux 6 questions, Enregistrer. C'est obligatoire chaque jour : sans ça, Accueil, Séance et Rugby restent verrouillés. Rappel à 8h, puis à 10h.",
      "Après chaque entraînement, le jour même : Rugby, ton effort ressenti (RPE de 1 à 10) et la durée de chaque activité. Rappel à 20h s'il en manque. Le lendemain, ce n'est plus possible sauf si le staff te relance.",
      "Si une activité prévue n'a pas eu lieu : « Je n'ai pas fait » et la raison. Ce n'est alors pas compté comme un oubli.",
      "En musculation : Séance, pour chaque exercice Fait / Partiel / Non fait et ton RPE, puis « Terminer la séance ». Une séance non terminée est validée automatiquement à 23h30.",
    ],
  },
  {
    title: 'Après un match',
    items: ["Perf › Notes : choisis ton coq et écris un vrai commentaire (au moins une phrase), puis « Valider ma note ». La note du coach s'affiche juste après la tienne."],
  },
  {
    title: 'Les onglets',
    items: [
      "Accueil : ce qu'il te reste à faire aujourd'hui, ta fatigue, ta charge de la semaine, tes séances à venir et ton dernier match.",
      "Séance : ta musculation du jour. Un bloc de plusieurs exercices est un enchaînement : A1 → repos → A2 → repos, autant de tours qu'indiqué. Une séance manquée peut être refaite un autre jour de la même semaine.",
      "Rugby : tes activités du jour à déclarer. Vidéo et soins : un simple « J'y étais ».",
      "Perf : tes notes de match, ton GPS comparé aux attendus de ton poste, tes tests et objectifs, tes coqs FFR (bleu premium, vert très bon, jaune bon, rouge à améliorer) et tes médailles quand tu es sur le podium du groupe.",
      "Forme : 6 questions notées de 1 à 5, 5 = meilleur état pour toutes. Tu vois ta fatigue en %.",
    ],
  },
  {
    title: 'Si tu es blessé',
    items: [
      "Tu gardes l'état de forme chaque matin ; tes séances de réhab et de membres sains sont dans Séance : note ta douleur de 0 à 10 sur chaque exercice.",
      "Ajoute toi-même ton cardio et ta reprise terrain dans Rugby. Ton plan de retour est sur ton Accueil.",
    ],
  },
  {
    title: 'Ce que le staff attend de toi',
    items: [
      "La forme chaque matin, le RPE après chaque entraînement (honnête, pas « par défaut »), tes retours de musculation, « Je n'ai pas fait » plutôt que vide, un commentaire à chaque match, les notifications activées.",
    ],
  },
  {
    title: 'Problèmes fréquents',
    items: [
      "Onglets verrouillés : ton état de forme du jour n'est pas rempli.",
      "« Ce jour n'est plus modifiable » : le délai est passé, demande au staff.",
      "Pas de notification : active-les ci-dessus. Sur iPhone, l'app doit être installée sur l'écran d'accueil (Safari › Partager › Sur l'écran d'accueil).",
      "Mot de passe oublié : le staff le réinitialise.",
    ],
  },
]

export const STAFF_GUIDE: GuideSection[] = [
  {
    title: 'Comptes et navigation',
    items: [
      "Admin : déclarer un joueur blessé ou apte, ratio aigu/chronique. Coach : tout le reste. Les comptes sont créés par l'admin.",
      "Ordinateur : barre latérale qui s'ouvre au survol. Téléphone : bouton ☰. Le compte joueur.test sert à voir l'interface joueur : lecture seule, absent de tous les chiffres.",
    ],
  },
  {
    title: 'Les onglets',
    items: [
      "Aujourd'hui : forme de l'effectif, alertes (score < 16/30 ou un item à 1), à relancer, RPE non déclarés sur 7 jours et « déclarées non faites » avec leur raison.",
      "Semaine : charge de chacun (RPE × minutes), statut REG 500-1500, COMP 1500-2500, DEV > 2500 UA, RPE moyen face au RPE visé, exports PowerPoint et Excel. Les blessés sont suivis dans Médical.",
      "Joueur : fiche individuelle, taux de déclaration de la saison, ratio aigu/chronique (4 jours d'entraînement), tests, gestion.",
      "Musculation : séances et retours exercice par exercice, bilan de cycle.",
      "Programmation : semaines et duplication (+2,5 % si validée avec RPE < 5, +1,25 % si RPE ≥ 5, −2,5 % si non validée avec RPE ≥ 7 ; options « Musculation seulement » et « Charges identiques »), planning du groupe, séance de musculation et son intitulé, import d'un cycle, RPE visés et seuils.",
      "Performance : GPS, notes de match et consignes, tests et coqs FFR du groupe, import des maxi et objectifs, barème FFR.",
      "Médical : suivi du joueur blessé (douleur, RPE, séances), plan de retour, préparation (import du plan, créateur, import des séances, fiche blessure), épidémiologie.",
    ],
  },
  {
    title: 'Routine conseillée',
    items: [
      "Chaque matin : Aujourd'hui (alertes, relances). Le soir ou le lendemain : RPE non déclarés.",
      "Début de semaine : dupliquer la semaine, vérifier la charge prévue face à la cible.",
      "Début de cycle : importer les fiches (vérifier « Semaine 1 du cycle », « Lundi - Intitulé », « Lundi RÉHAB : » pour les blessés), mettre à jour les objectifs.",
      "Après un match : noter, importer les GPS. Après des tests : importer les maxi, regarder les coqs.",
      "Avant la fin d'un cycle : ajouter les semaines suivantes au calendrier.",
    ],
  },
  {
    title: 'Gestes clés',
    items: [
      "Relancer : Aujourd'hui › À relancer. Dupliquer : Programmation › Semaines et duplication. Importer un cycle : Programmation › Import d'un cycle.",
      "Déclarer un blessé : fiche Joueur › Gestion (admin) ; une fiche blessure et un plan de retour sont créés. Plan de réhab : Médical › Préparer. Tests : Performance › Test.",
    ],
  },
]

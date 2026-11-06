// Activités du jour à déclarer, à partir des séances planifiées visibles par le joueur (RLS : les siennes et celles de ses groupes)

// La séance de musculation se valide exercice par exercice (étape 5), pas ici
export const MUSCULATION = 'Musculation'
// Séances à exercices (onglet Séance) : la musculation, et pour un blessé la réhab et les membres sains (0034)
export const EXERCISE_SESSIONS = [MUSCULATION, 'Réhabilitation', 'Membres sains']
// Ce qu'un joueur blessé ajoute lui-même (il n'a plus les séances du groupe)
export const INJURED_EXTRAS = ['Cardio (porté / course)', 'Reprise terrain']

// « Je n'ai pas fait » (0041) : raison obligatoire ; « autre » demande une précision
export const SKIP_REASONS = { malade: 'Malade / douleur', absent: 'Absent (cours, rendez-vous)', annulee: 'Séance annulée ou modifiée', autre: 'Autre' } as const
export type SkipReason = keyof typeof SKIP_REASONS

export type PlannedRow = {
  id: string
  player_id: string | null
  planned_duration_min: number | null
  activity_types: { id: string; name: string; requires_rpe: boolean; default_duration_min: number | null }
}

export type DayActivity = {
  plannedSessionId: string | null
  activityTypeId: string
  name: string
  requiresRpe: boolean
  durationMin: number | null
}

// includeMuscu : pour l'aperçu « À venir » (la déclaration de la muscu passe par l'onglet Séance)
export function dayActivities(plan: PlannedRow[], { injured, includeMuscu = false }: { injured: boolean; includeMuscu?: boolean }): DayActivity[] {
  const byActivity = new Map<string, DayActivity>()
  const individualIds = new Set<string>()
  for (const s of plan) {
    const a = s.activity_types
    const individual = s.player_id !== null
    // Séance individuelle à exercices : onglet Séance ; programmée pour le groupe, elle se déclare comme une activité
    if (EXERCISE_SESSIONS.includes(a.name) && individual && !includeMuscu) continue
    if (injured && !individual) continue // blessé : seulement son programme individuel
    // Une seule déclaration par activité et par jour : le programme individuel l'emporte sur celui du groupe
    if (individualIds.has(a.id) && !individual) continue
    if (individual) individualIds.add(a.id)
    byActivity.set(a.id, {
      plannedSessionId: s.id, activityTypeId: a.id, name: a.name, requiresRpe: a.requires_rpe,
      durationMin: s.planned_duration_min ?? a.default_duration_min,
    })
  }
  return [...byActivity.values()]
}

// Activités prévues jour par jour (mêmes règles : blessé, une ligne par activité et par jour)
export function upcomingByDay(plan: (PlannedRow & { session_date: string })[], { injured }: { injured: boolean }) {
  const dates = [...new Set(plan.map(s => s.session_date))].sort()
  return dates
    .map(date => ({ date, activities: dayActivities(plan.filter(s => s.session_date === date), { injured, includeMuscu: true }) }))
    .filter(d => d.activities.length)
}

// Échelle RPE de Borg (CR-10) du staff, reprise telle quelle de public/RPE - Borg.png : saisie de 1 à 10,
// 6, 8 et 9 sans libellé (paliers intermédiaires). Index = valeur ; l'index 0 n'est plus proposé à la saisie.
export const RPE_LABELS = ['', 'Très très facile', 'Facile', 'Modéré', 'Quelque peu difficile', 'Difficile',
  '', 'Très difficile', '', '', 'Maximal']
export const RPE_COLORS = ['', '#ccffcc', '#cbff99', '#ffff99', '#feff00', '#ffd966', '#ffc000', '#ed7d32', '#f05227', '#ff0300', '#000000']
export const rpeInk = (v: number) => (v === 10 ? '#ffffff' : '#1a1a1a') // chiffre noir comme sur la feuille, blanc sur le 10 noir

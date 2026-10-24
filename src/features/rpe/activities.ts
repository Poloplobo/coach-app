// Activités du jour à déclarer, à partir des séances planifiées visibles par le joueur (RLS : les siennes et celles de ses groupes)

// La séance de musculation se valide exercice par exercice (étape 5), pas ici
export const MUSCULATION = 'Musculation'

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
    if (a.name === MUSCULATION && !includeMuscu) continue
    const individual = s.player_id !== null
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

// Échelle CR-10 (Borg / Foster)
export const RPE_LABELS = ['Repos', 'Très, très facile', 'Facile', 'Modéré', 'Un peu difficile', 'Difficile',
  'Difficile', 'Très difficile', 'Très difficile', 'Presque maximal', 'Maximal']

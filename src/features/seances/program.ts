// Séance de musculation individuelle : exercices en blocs (MOB, A1, A2, B1… F), retour du joueur par exercice

export type FeedbackStatus = 'fait' | 'partiel' | 'non fait'
export type Feedback = { rpe: number | null; done_load: string | null; status: string | null; comment: string | null }
export type PlannedExercise = {
  id: string; position: number; block_label: string | null; sets: number | null; reps: string | null
  load_value: number | null; load_unit: string | null; tempo: string | null; rest: string | null; instructions: string | null
  exercises: { name: string }
  exercise_feedback: Feedback[]
}

export const STATUSES: { value: FeedbackStatus; label: string }[] = [
  { value: 'fait', label: 'Fait' }, { value: 'partiel', label: 'Partiel' }, { value: 'non fait', label: 'Non fait' },
]

export function sortedExercises(exercises: PlannedExercise[]) {
  return [...exercises].sort((a, b) => a.position - b.position)
}

export function formatLoad(e: Pick<PlannedExercise, 'load_value' | 'load_unit' | 'instructions'>): string | null {
  // unité sans valeur (import ou saisie incomplète) : ne jamais afficher « null »
  switch (e.load_unit) {
    case 'pct_rm': return e.load_value === null ? null : `${e.load_value} %RM`
    case 'kg': return e.load_value === null ? null : `${e.load_value} kg`
    case 'bw': return e.load_value === null ? 'PDC' : `${e.load_value} % PDC`
    case 'free': return e.instructions ?? 'Charge libre'
    default: return null
  }
}

// « 5 × 5 · 80 %RM · tempo 4.0.1.0 · repos 2' »
export function prescription(e: PlannedExercise): string {
  const volume = e.sets && e.reps ? `${e.sets} × ${e.reps}` : e.reps ?? (e.sets ? `${e.sets} séries` : null)
  return [volume, formatLoad(e), e.tempo && `tempo ${e.tempo}`, e.rest && `repos ${e.rest}`].filter(Boolean).join(' · ')
}

// Taux de complétion : exercices « fait » sur le total de la séance
export function completion(exercises: PlannedExercise[]) {
  const done = exercises.filter(e => e.exercise_feedback[0]?.status === 'fait').length
  return { done, total: exercises.length, pct: exercises.length ? Math.round((100 * done) / exercises.length) : 0 }
}

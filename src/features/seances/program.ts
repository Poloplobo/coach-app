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

const fr = (v: number) => Number(v).toLocaleString('fr-FR')

export function formatLoad(e: Pick<PlannedExercise, 'load_value' | 'load_unit' | 'instructions'>): string | null {
  // unité sans valeur (import ou saisie incomplète) : ne jamais afficher « null »
  switch (e.load_unit) {
    case 'pct_rm': return e.load_value === null ? null : `${fr(e.load_value)} %RM`
    case 'kg': return e.load_value === null ? null : `${fr(e.load_value)} kg`
    case 'bw': return e.load_value === null ? 'PDC' : `${fr(e.load_value)} % PDC`
    case 'free': return e.instructions ?? 'Charge libre'
    default: return null
  }
}

// « 5 × 5 · 80 %RM · 3 RER · tempo 4.0.1.0 · repos 2' » : la consigne suit la charge (en charge libre, elle EST la charge)
export function prescription(e: PlannedExercise): string {
  const p = prescriptionParts(e)
  return [p.volume, p.load, p.note, p.tempo && `tempo ${p.tempo}`, p.rest && `repos ${p.rest}`].filter(Boolean).join(' · ')
}

// Les mêmes éléments séparés, pour la fiche du joueur (volume en gros, charge, tempo et repos en pastilles)
export function prescriptionParts(e: PlannedExercise) {
  return {
    volume: e.sets && e.reps ? `${e.sets} × ${e.reps}` : e.reps ?? (e.sets ? `${e.sets} séries` : null),
    load: formatLoad(e), note: e.load_unit !== 'free' ? e.instructions : null, tempo: e.tempo, rest: e.rest,
  }
}

// Taux de complétion : exercices « fait » sur le total de la séance
export function completion(exercises: PlannedExercise[]) {
  const done = exercises.filter(e => e.exercise_feedback[0]?.status === 'fait').length
  return { done, total: exercises.length, pct: exercises.length ? Math.round((100 * done) / exercises.length) : 0 }
}

// RPE de la séance de muscu = moyenne des RPE donnés aux exercices faits ou partiels, à 0,1 près (décision du 03/11/2026) ;
// null si aucun exercice n'a de RPE : le joueur donne alors un RPE global
export function sessionRpe(exercises: PlannedExercise[]) {
  const rpes = exercises.map(e => e.exercise_feedback[0]).filter(f => f && f.status !== 'non fait' && f.rpe !== null).map(f => Number(f.rpe))
  return rpes.length ? { rpe: Math.round((10 * rpes.reduce((a, b) => a + b, 0)) / rpes.length) / 10, count: rpes.length } : null
}

// Blocs de la fiche : A1 + A2 = bloc A (enchaînés), MOB = mobilité ; exercices déjà triés, blocs consécutifs regroupés
export function blockGroups(exercises: PlannedExercise[]) {
  const groups: { key: string; label: string; items: PlannedExercise[] }[] = []
  for (const e of exercises) {
    const raw = (e.block_label ?? '').trim().toUpperCase()
    const key = raw.startsWith('MOB') ? 'MOB' : raw.match(/^[A-Z]/)?.[0] ?? '—'
    const last = groups.at(-1)
    if (last?.key === key) last.items.push(e)
    else groups.push({ key, label: key === 'MOB' ? 'Mobilité' : key === '—' ? 'Exercices' : `Bloc ${key}`, items: [e] })
  }
  return groups
}

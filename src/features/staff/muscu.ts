// Suivi musculation staff : respect des charges, RPE, progression. Fonctions pures (testées), utilisées par la vue Musculation.

export type StaffFeedback = { player_id: string; rpe: number | null; done_load: string | null; status: string | null; comment: string | null }
export type StaffExercise = {
  id: string; position: number; block_label: string | null; sets: number | null; reps: string | null
  load_value: number | null; load_unit: string | null; tempo: string | null; rest: string | null; instructions: string | null
  exercises: { name: string }; exercise_feedback: StaffFeedback[]
}
export type StaffMuscuSession = { id: string; session_date: string; player_id: string | null; planned_exercises: StaffExercise[] }

// Charge réalisée saisie en texte libre, dans cet ordre de priorité :
// 1. un nombre suivi de « kg » : « 3x8 80kg » → 80, « 80kg x 5 » → 80 ;
// 2. un nombre isolé à côté de « séries x reps » : « 5x5 100 » → 100 ;
// 3. sinon « séries x charge » : « 2x125 1x120 » → 125 ; ou le seul nombre : « 60 » → 60, « 62,5 » → 62,5.
// shortcut: lecture heuristique (« 8+8 » ou « 5-5 » sont pris tels quels) ; à remplacer par une saisie série par série si besoin
export function parseDoneLoad(text: string | null): number | null {
  if (!text) return null
  const t = text.replace(/,/g, '.').toLowerCase()
  const max = (values: number[]) => (values.length ? Math.max(...values) : null)
  const kg = [...t.matchAll(/(\d+(?:\.\d+)?)\s*kg/g)].map(m => Number(m[1]))
  if (kg.length) return max(kg)
  const pair = /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/g
  const standalone = [...t.replace(pair, ' ').matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]))
  if (standalone.length) return max(standalone)
  return max([...t.matchAll(pair)].map(m => Number(m[2])))
}

export type Respect = 'oui' | 'partiel' | 'non' | null

// Respecté : exercice « fait » ET, si la prescription est en kg, charge réalisée ≥ charge prescrite.
// %RM, poids de corps ou charge libre : pas de 1RM fiable pour convertir, seul le statut compte.
export function respected(e: Pick<StaffExercise, 'load_value' | 'load_unit'>, f: Pick<StaffFeedback, 'status' | 'done_load'> | undefined): Respect {
  if (!f?.status) return null
  if (f.status === 'non fait') return 'non'
  if (f.status === 'partiel') return 'partiel'
  if (e.load_unit === 'kg' && e.load_value !== null) {
    const done = parseDoneLoad(f.done_load)
    if (done === null) return 'partiel' // fait, mais charge non renseignée : impossible de vérifier
    return done >= Number(e.load_value) ? 'oui' : 'non'
  }
  return 'oui'
}

// Résumé d'un joueur sur la période : séances, validation, complétion, RPE de séance, exercice le plus dur, respect
export function muscuSummary(sessions: StaffMuscuSession[], sessionRpes: number[]) {
  const exercises = sessions.flatMap(s => s.planned_exercises)
  const feedback = exercises.map(e => ({ e, f: e.exercise_feedback[0] }))
  const answered = feedback.filter(x => x.f?.status)
  const respect = answered.map(x => respected(x.e, x.f))
  const hardest = feedback.filter(x => x.f?.rpe != null).sort((a, b) => Number(b.f!.rpe) - Number(a.f!.rpe))[0]
  return {
    sessions: sessions.length,
    exercises: exercises.length,
    done: answered.filter(x => x.f!.status === 'fait').length,
    completionPct: exercises.length ? Math.round((100 * answered.filter(x => x.f!.status === 'fait').length) / exercises.length) : 0,
    sessionRpe: sessionRpes.length ? Math.round((10 * sessionRpes.reduce((a, b) => a + b, 0)) / sessionRpes.length) / 10 : null,
    hardest: hardest ? { name: hardest.e.exercises.name, rpe: Number(hardest.f!.rpe) } : null,
    respected: respect.filter(r => r === 'oui').length,
    partial: respect.filter(r => r === 'partiel').length,
    notRespected: respect.filter(r => r === 'non').length,
  }
}

// Progression d'un exercice : charge maximale réalisée à chaque séance (et charge prescrite si elle est en kg)
export function loadProgression(sessions: StaffMuscuSession[], exerciseName: string) {
  return sessions
    .flatMap(s => s.planned_exercises.filter(e => e.exercises.name === exerciseName).map(e => ({
      date: s.session_date,
      done: parseDoneLoad(e.exercise_feedback[0]?.done_load ?? null),
      prescribed: e.load_unit === 'kg' && e.load_value !== null ? Number(e.load_value) : null,
    })))
    .filter(p => p.done !== null || p.prescribed !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

// Exercices dont au moins une charge réalisée est lisible : ceux qu'on peut suivre en progression
export const trackedExercises = (sessions: StaffMuscuSession[]) =>
  [...new Set(sessions.flatMap(s => s.planned_exercises
    // une charge nulle (gainage, PDC) ne fait pas une courbe de progression
    .filter(e => (parseDoneLoad(e.exercise_feedback[0]?.done_load ?? null) ?? 0) > 0).map(e => e.exercises.name)))].sort()

// Programmation staff : fonctions pures (testées) utilisées par les écrans de l'onglet Programmation
import { addDays, isoWeekStart } from '../../../lib/week'
import { respected, type StaffExercise, type StaffFeedback, type StaffMuscuSession } from '../muscu'
import type { ExerciseRowInput, WeekForm } from './useProgramming'

type Week = { code: string; start_date: string }

// Semaine suivante proposée : S<n+1>, lundi suivant la dernière semaine du calendrier
export function nextWeek(weeks: Week[], today: string): Pick<WeekForm, 'code' | 'start_date'> {
  const last = [...weeks].sort((a, b) => a.start_date.localeCompare(b.start_date)).at(-1)
  const n = Math.max(0, ...weeks.map(w => Number(w.code.match(/^S(\d+)$/)?.[1] ?? 0)))
  return { code: `S${n + 1}`, start_date: last ? addDays(last.start_date, 7) : isoWeekStart(today) }
}

export function weekErrors(form: WeekForm, weeks: Week[], previousCode?: string): string[] {
  const others = weeks.filter(w => w.code !== previousCode)
  const errors: string[] = []
  if (!/^S\d+$/.test(form.code)) errors.push('Code attendu : S suivi d\'un numéro (ex. S9).')
  else if (others.some(w => w.code === form.code)) errors.push(`${form.code} existe déjà.`)
  if (!form.start_date || isoWeekStart(form.start_date) !== form.start_date) errors.push('La semaine doit commencer un lundi.')
  else if (others.some(w => w.start_date === form.start_date)) errors.push('Une autre semaine commence déjà ce lundi.')
  if (!form.week_type_code) errors.push('Choisis le type de semaine.')
  return errors
}

// Séances du groupe rangées par jour de la semaine (lundi → dimanche)
export function planByDay<T extends { session_date: string }>(plan: T[], weekStart: string): { date: string; items: T[] }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i)
    return { date, items: plan.filter(p => p.session_date === date) }
  })
}

// Édition d'une séance de musculation : ligne de formulaire ↔ exercice planifié
export type EditRow = ExerciseRowInput & { key: string; hasFeedback: boolean }

let counter = 0
export const newRow = (exerciseId = ''): EditRow => ({
  key: `new-${++counter}`, exercise_id: exerciseId, block_label: '', sets: null, reps: '', load_value: null, load_unit: 'free',
  tempo: '', rest: '', instructions: '', hasFeedback: false,
})

export function rowsFromSession(exercises: (StaffExercise & { exercise_id?: string })[], exerciseIdByName: Map<string, string>): EditRow[] {
  return [...exercises].sort((a, b) => a.position - b.position).map(e => ({
    key: e.id, id: e.id, exercise_id: e.exercise_id ?? exerciseIdByName.get(e.exercises.name) ?? '',
    block_label: e.block_label ?? '', sets: e.sets, reps: e.reps ?? '', load_value: e.load_value === null ? null : Number(e.load_value),
    load_unit: e.load_unit ?? 'free', tempo: e.tempo ?? '', rest: e.rest ?? '', instructions: e.instructions ?? '',
    hasFeedback: e.exercise_feedback.length > 0,
  }))
}

// Une ligne sans exercice choisi bloquerait l'enregistrement : on la signale plutôt que de la perdre en silence
export function rowsErrors(rows: EditRow[]): string[] {
  return rows.flatMap((r, i) => [
    ...(!r.exercise_id ? [`Ligne ${i + 1} : choisis un exercice.`] : []),
    ...(r.load_unit !== 'free' && r.load_value === null ? [`Ligne ${i + 1} : indique la charge (ou « libre »).`] : []),
  ])
}

// Seuls les champs de l'exercice partent en base (pas la clé d'affichage ni l'indicateur de retour)
export const toPayload = (rows: EditRow[]): ExerciseRowInput[] => rows.map(r => ({
  ...(r.id ? { id: r.id } : {}), exercise_id: r.exercise_id, block_label: r.block_label, sets: r.sets, reps: r.reps,
  load_value: r.load_unit === 'free' ? null : r.load_value, load_unit: r.load_unit, tempo: r.tempo, rest: r.rest, instructions: r.instructions,
}))

export function moveRow(rows: EditRow[], index: number, delta: -1 | 1): EditRow[] {
  const to = index + delta
  if (to < 0 || to >= rows.length) return rows
  const next = [...rows]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

// Duplication : charge de la semaine suivante selon le retour du joueur (kg et %RM ; PDC et libre inchangés), arrondie au 0,5.
// Validé (fait, charge atteinte) : +2,5 % si RPE < 5, +1,25 % sinon (RPE ≥ 5 ou non renseigné, par prudence).
// Non validé avec RPE ≥ 7 : -2,5 %. Tout autre cas (partiel ou non fait sans gros RPE, pas de retour) : charge identique.
export function progressedLoad(e: Pick<StaffExercise, 'load_value' | 'load_unit'>, f: StaffFeedback | undefined): number | null {
  if (e.load_value === null || (e.load_unit !== 'kg' && e.load_unit !== 'pct_rm')) return e.load_value
  const rpe = f?.rpe ?? null
  const factor = respected(e, f) === 'oui' ? (rpe !== null && rpe < 5 ? 1.025 : 1.0125) : rpe !== null && rpe >= 7 ? 0.975 : 1
  return Math.round(Number(e.load_value) * factor * 2) / 2
}

// Charges à transmettre à duplicate_week : seulement celles qui changent
export function progressedLoads(sessions: StaffMuscuSession[]): Record<string, number> {
  return Object.fromEntries(sessions.flatMap(s => s.planned_exercises.flatMap(e => {
    const next = progressedLoad(e, e.exercise_feedback[0])
    return next !== null && next !== Number(e.load_value) ? [[e.id, next]] : []
  })))
}

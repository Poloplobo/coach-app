import { describe, expect, it } from 'vitest'
import { loadProgression, muscuSummary, parseDoneLoad, respected, trackedExercises, type StaffExercise, type StaffMuscuSession } from './muscu'

describe('parseDoneLoad : charge réalisée en texte libre', () => {
  it('séries x charge : la charge la plus lourde', () => {
    expect(parseDoneLoad('2x125 1x120')).toBe(125)
    expect(parseDoneLoad('5 x 45')).toBe(45)
  })
  it('nombre seul, virgule décimale', () => {
    expect(parseDoneLoad('60')).toBe(60)
    expect(parseDoneLoad('62,5 kg')).toBe(62.5)
  })
  it('« séries x reps » suivi de la charge : la charge, pas les reps', () => {
    expect(parseDoneLoad('3x8 80kg')).toBe(80)
    expect(parseDoneLoad('5x5 100')).toBe(100)
    expect(parseDoneLoad('80kg x 5')).toBe(80)
    expect(parseDoneLoad('8+8 60')).toBe(60)
  })
  it('vide ou sans nombre : rien', () => {
    expect(parseDoneLoad('PDC')).toBeNull()
    expect(parseDoneLoad(null)).toBeNull()
    expect(parseDoneLoad('à toi de voir')).toBeNull()
  })
})

const fb = (status: string | null, done_load: string | null = null, rpe: number | null = null) => ({ player_id: 'p', rpe, done_load, status, comment: null })
const ex = (name: string, load_unit: string | null, load_value: number | null, f?: ReturnType<typeof fb>): StaffExercise => ({
  id: name, position: 1, block_label: 'A1', sets: 5, reps: '5', load_value, load_unit, tempo: null, rest: null, instructions: null,
  exercises: { name }, exercise_feedback: f ? [f] : [],
})

describe('respected : statut + charge en kg', () => {
  it('prescription en kg : fait ET charge atteinte', () => {
    expect(respected(ex('DC', 'kg', 80), fb('fait', '2x80'))).toBe('oui')
    expect(respected(ex('DC', 'kg', 80), fb('fait', '75'))).toBe('non')
    expect(respected(ex('DC', 'kg', 80), fb('fait', null))).toBe('partiel') // impossible de vérifier
  })
  it('prescription en %RM ou libre : seul le statut compte', () => {
    expect(respected(ex('FS', 'pct_rm', 80), fb('fait', '60'))).toBe('oui')
    expect(respected(ex('FS', 'free', null), fb('partiel'))).toBe('partiel')
    expect(respected(ex('FS', 'pct_rm', 80), fb('non fait'))).toBe('non')
  })
  it('pas de retour : non évalué', () => {
    expect(respected(ex('FS', 'kg', 80), undefined)).toBeNull()
  })
})

const session = (date: string, exercises: StaffExercise[]): StaffMuscuSession => ({ id: date, session_date: date, player_id: 'p', planned_exercises: exercises })

it('muscuSummary : séances, complétion, RPE de séance moyen, exercice le plus dur, respect', () => {
  const s = muscuSummary([
    session('2026-10-05', [ex('DC', 'kg', 80, fb('fait', '2x80', 7)), ex('FS', 'pct_rm', 80, fb('non fait')), ex('Gainage', null, null)]),
    session('2026-10-07', [ex('BS', 'kg', 100, fb('fait', '95', 9))]),
  ], [6, 8])
  expect(s).toEqual({ sessions: 2, exercises: 4, done: 2, completionPct: 50, sessionRpe: 7, hardest: { name: 'BS', rpe: 9 },
    respected: 1, partial: 0, notRespected: 2 })
})

it('loadProgression et trackedExercises : charge max par séance, dans l\'ordre des dates', () => {
  const sessions = [
    session('2026-10-12', [ex('DC', 'kg', 85, fb('fait', '2x85 1x87,5'))]),
    session('2026-10-05', [ex('DC', 'kg', 80, fb('fait', '80')), ex('Gainage', null, null, fb('fait'))]),
  ]
  expect(loadProgression(sessions, 'DC')).toEqual([
    { date: '2026-10-05', done: 80, prescribed: 80 },
    { date: '2026-10-12', done: 87.5, prescribed: 85 },
  ])
  expect(trackedExercises(sessions)).toEqual(['DC'])
})

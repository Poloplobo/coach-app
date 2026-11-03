import { describe, expect, it } from 'vitest'
import { blockGroups, completion, prescription, estimatedKg, lastLoads, restSeconds, sessionRpe, sortedExercises, type PlannedExercise } from './program'

const ex = (position: number, over: Partial<PlannedExercise> = {}): PlannedExercise => ({
  id: `e${position}`, exercise_id: 'x-squat', position, block_label: 'A1', sets: 5, reps: '5', load_value: 80, load_unit: 'pct_rm',
  tempo: '4.0.1.0', rest: "2'", instructions: null, exercises: { name: `Exercice ${position}` }, exercise_feedback: [], ...over,
})
const fb = (status: string) => [{ rpe: 7, done_load: '60', status, comment: null }]

it('les exercices suivent l\'ordre de la fiche, quel que soit l\'ordre reçu', () => {
  expect(sortedExercises([ex(3), ex(1), ex(2)]).map(e => e.position)).toEqual([1, 2, 3])
})

describe('prescription', () => {
  it('séries × reps, charge, tempo, repos', () => {
    expect(prescription(ex(1))).toBe("5 × 5 · 80 %RM · tempo 4.0.1.0 · repos 2'")
  })
  it('reps en texte, charge libre, % du poids de corps', () => {
    expect(prescription(ex(1, { reps: '6/côté', load_unit: 'free', load_value: null, instructions: 'à toi de voir', tempo: null, rest: null })))
      .toBe('5 × 6/côté · à toi de voir')
    expect(prescription(ex(1, { sets: null, reps: 'AMRAP', load_unit: 'bw', load_value: 60, tempo: null, rest: null })))
      .toBe('AMRAP · 60 % PDC')
  })
  it('unité sans valeur : pas de « null » affiché', () => {
    expect(prescription(ex(1, { load_unit: 'bw', load_value: null, tempo: null, rest: null }))).toBe('5 × 5 · PDC')
    expect(prescription(ex(1, { load_unit: 'kg', load_value: null, tempo: null, rest: null }))).toBe('5 × 5')
  })
})

describe('prescription : consigne et nombres', () => {
  it('la consigne suit une charge en %RM (RER, précision) ; détail MOB sans charge affiché ; virgule française', () => {
    expect(prescription(ex(1, { load_value: 90, instructions: '90%3RM 3 RER', tempo: null, rest: null }))).toBe('5 × 5 · 90 %RM · 90%3RM 3 RER')
    expect(prescription(ex(1, { sets: null, reps: "5''", load_unit: null, load_value: null, instructions: 'Rotation Externe', tempo: null, rest: null }))).toBe("5'' · Rotation Externe")
    expect(prescription(ex(1, { load_value: 92.5, tempo: null, rest: null }))).toBe('5 × 5 · 92,5 %RM')
  })
})

describe('completion', () => {
  it('compte les exercices « fait » seulement', () => {
    expect(completion([ex(1, { exercise_feedback: fb('fait') }), ex(2, { exercise_feedback: fb('partiel') }), ex(3), ex(4, { exercise_feedback: fb('fait') })]))
      .toEqual({ done: 2, total: 4, pct: 50 })
  })
  it('séance vide : 0 %, pas de division par zéro', () => {
    expect(completion([])).toEqual({ done: 0, total: 0, pct: 0 })
  })
})

it('blocs de la fiche : A1 + A2 ensemble, MOB à part, étiquette absente regroupée', () => {
  const g = blockGroups([ex(1, { block_label: 'MOB' }), ex(2, { block_label: 'A1' }), ex(3, { block_label: 'a2' }), ex(4, { block_label: 'B1' }), ex(5, { block_label: null })])
  expect(g.map(x => [x.label, x.items.map(i => i.position)])).toEqual([['Mobilité', [1]], ['Bloc A', [2, 3]], ['Bloc B', [4]], ['Exercices', [5]]])
})

describe('sessionRpe : RPE de séance = moyenne des RPE des exercices', () => {
  const rated = (status: string, rpe: number | null) => [{ rpe, done_load: null, status, comment: null }]
  it('moyenne des exercices faits ou partiels, à 0,1 près ; non faits et sans RPE ignorés', () => {
    expect(sessionRpe([
      ex(1, { exercise_feedback: rated('fait', 7) }), ex(2, { exercise_feedback: rated('partiel', 8) }), ex(3, { exercise_feedback: rated('fait', 6) }),
      ex(4, { exercise_feedback: rated('fait', 5) }), ex(5, { exercise_feedback: rated('non fait', 2) }), ex(6, { exercise_feedback: rated('fait', null) }), ex(7),
    ])).toEqual({ rpe: 6.5, count: 4 })
    expect(sessionRpe([ex(1, { exercise_feedback: rated('fait', 7) }), ex(2, { exercise_feedback: rated('fait', 8) }), ex(3, { exercise_feedback: rated('fait', 8) })]))
      .toEqual({ rpe: 7.7, count: 3 })
  })
  it('aucun RPE d\'exercice : null (le joueur donne un RPE global)', () => {
    expect(sessionRpe([ex(1), ex(2, { exercise_feedback: rated('non fait', null) })])).toBeNull()
  })
})

describe('restSeconds', () => {
  it('lit les écritures des fiches', () => {
    expect(restSeconds("2'")).toBe(120)
    expect(restSeconds("1'30")).toBe(90)
    expect(restSeconds("1'30''")).toBe(90)
    expect(restSeconds("90''")).toBe(90)
    expect(restSeconds('90s')).toBe(90)
    expect(restSeconds('2 min')).toBe(120)
    expect(restSeconds('1min30')).toBe(90)
    expect(restSeconds('2’')).toBe(120)
  })
  it('texte illisible ou vide : pas de minuteur', () => {
    expect(restSeconds(null)).toBeNull()
    expect(restSeconds('')).toBeNull()
    expect(restSeconds('récup complète')).toBeNull()
    expect(restSeconds("0'")).toBeNull()
  })
})

describe('estimatedKg', () => {
  const maxes = [
    { exercise_id: 'x-squat', test: 'Back Squat 3RM', date: '2026-09-01', value: 110 },
    { exercise_id: 'x-squat', test: 'Back Squat 3RM', date: '2026-10-12', value: 126 },
    { exercise_id: 'x-dc', test: 'DC 3RM', date: '2026-10-12', value: 90 },
  ]
  it('% × dernier test lié à l\'exercice, arrondi à 2,5 kg', () => {
    expect(estimatedKg(ex(1), maxes)).toEqual({ kg: 100, ref: maxes[1] }) // 80 % de 126 = 100,8
    expect(estimatedKg(ex(1, { load_value: 85 }), maxes)?.kg).toBe(107.5) // 107,1
  })
  it('rien sans lien, sans %RM ou avec une autre référence en consigne', () => {
    expect(estimatedKg(ex(1, { exercise_id: 'x-autre' }), maxes)).toBeNull()
    expect(estimatedKg(ex(1, { load_unit: 'kg' }), maxes)).toBeNull()
    expect(estimatedKg(ex(1, { load_value: null }), maxes)).toBeNull()
    expect(estimatedKg(ex(1, { instructions: '5RM' }), maxes)).toBeNull()
    expect(estimatedKg(ex(1, { instructions: '3 RER' }), maxes)?.kg).toBe(100)
  })
})

it('lastLoads : la plus récente par exercice', () => {
  const m = lastLoads([
    { exercise_id: 'a', date: '2026-10-20', done_load: '2x120' },
    { exercise_id: 'a', date: '2026-10-27', done_load: '2x125 1x120' },
    { exercise_id: 'b', date: '2026-10-21', done_load: '60' },
  ])
  expect(m.get('a')?.done_load).toBe('2x125 1x120')
  expect(m.get('b')?.date).toBe('2026-10-21')
})

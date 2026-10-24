import { describe, expect, it } from 'vitest'
import { completion, prescription, sortedExercises, type PlannedExercise } from './program'

const ex = (position: number, over: Partial<PlannedExercise> = {}): PlannedExercise => ({
  id: `e${position}`, position, block_label: 'A1', sets: 5, reps: '5', load_value: 80, load_unit: 'pct_rm',
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

describe('completion', () => {
  it('compte les exercices « fait » seulement', () => {
    expect(completion([ex(1, { exercise_feedback: fb('fait') }), ex(2, { exercise_feedback: fb('partiel') }), ex(3), ex(4, { exercise_feedback: fb('fait') })]))
      .toEqual({ done: 2, total: 4, pct: 50 })
  })
  it('séance vide : 0 %, pas de division par zéro', () => {
    expect(completion([])).toEqual({ done: 0, total: 0, pct: 0 })
  })
})

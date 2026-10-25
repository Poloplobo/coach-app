import { describe, expect, it } from 'vitest'
import { moveRow, newRow, nextWeek, planByDay, progressedLoad, progressedLoads, rowsErrors, rowsFromSession, toPayload, weekErrors } from './programming'

const weeks = [{ code: 'S1', start_date: '2026-09-14' }, { code: 'S8', start_date: '2026-11-02' }]
const form = (over = {}) => ({ code: 'S9', label: '', start_date: '2026-11-09', week_type_code: 'DEV', cycle: '', phase_note: '', is_off: false, ...over })

it('nextWeek : S<n+1>, lundi suivant la dernière semaine', () => {
  expect(nextWeek(weeks, '2026-10-25')).toEqual({ code: 'S9', start_date: '2026-11-09' })
  expect(nextWeek([], '2026-10-28')).toEqual({ code: 'S1', start_date: '2026-10-26' })
})

describe('weekErrors', () => {
  it('semaine valide', () => expect(weekErrors(form(), weeks)).toEqual([]))
  it('code et lundi déjà pris, jour qui n\'est pas un lundi, type manquant', () => {
    expect(weekErrors(form({ code: 'S8' }), weeks)).toEqual(['S8 existe déjà.'])
    expect(weekErrors(form({ start_date: '2026-11-02' }), weeks)).toEqual(['Une autre semaine commence déjà ce lundi.'])
    expect(weekErrors(form({ start_date: '2026-11-10' }), weeks)).toEqual(['La semaine doit commencer un lundi.'])
    expect(weekErrors(form({ code: '9', week_type_code: '' }), weeks)).toHaveLength(2)
  })
  it('modifier une semaine existante ne la compare pas à elle-même', () => {
    expect(weekErrors(form({ code: 'S8', start_date: '2026-11-02' }), weeks, 'S8')).toEqual([])
  })
})

it('planByDay : 7 jours, séances rangées à leur date', () => {
  const days = planByDay([{ session_date: '2026-11-11', id: 'a' }, { session_date: '2026-11-09', id: 'b' }], '2026-11-09')
  expect(days.map(d => d.items.map(i => i.id))).toEqual([['b'], [], ['a'], [], [], [], []])
})

describe('édition d\'une séance de musculation', () => {
  const ex = (id: string, position: number, feedback = false) => ({
    id, position, block_label: 'A1', sets: 5, reps: '5', load_value: 80, load_unit: 'pct_rm', tempo: null, rest: null, instructions: null,
    exercises: { name: 'Front Squat' }, exercise_feedback: feedback ? [{ player_id: 'p', rpe: 7, done_load: '60', status: 'fait', comment: null }] : [],
  })
  const lib = new Map([['Front Squat', 'fs']])

  it('rowsFromSession : ordre des positions, exercice retrouvé, retour du joueur signalé', () => {
    const rows = rowsFromSession([ex('e2', 2, true), ex('e1', 1)], lib)
    expect(rows.map(r => [r.id, r.exercise_id, r.hasFeedback])).toEqual([['e1', 'fs', false], ['e2', 'fs', true]])
  })
  it('toPayload : retire les champs d\'écran, charge vide si « libre »', () => {
    const [row] = rowsFromSession([ex('e1', 1)], lib)
    expect(toPayload([{ ...row, load_unit: 'free' }])[0]).toEqual({
      id: 'e1', exercise_id: 'fs', block_label: 'A1', sets: 5, reps: '5', load_value: null, load_unit: 'free', tempo: '', rest: '', instructions: '',
    })
  })
  it('rowsErrors : exercice non choisi, charge manquante', () => {
    expect(rowsErrors([newRow(), { ...newRow('fs'), load_unit: 'kg' }])).toEqual(['Ligne 1 : choisis un exercice.', 'Ligne 2 : indique la charge (ou « libre »).'])
  })
  it('moveRow : monte ou descend, sans sortir de la liste', () => {
    const rows = [newRow('a'), newRow('b'), newRow('c')]
    expect(moveRow(rows, 2, -1).map(r => r.exercise_id)).toEqual(['a', 'c', 'b'])
    expect(moveRow(rows, 0, -1)).toBe(rows)
  })
})

describe('progressedLoad (duplication de semaine)', () => {
  const kg = { load_value: 100, load_unit: 'kg' }
  const fb = (status: string, rpe: number | null, done_load: string | null = '100') => ({ player_id: 'p', status, rpe, done_load, comment: null })
  it('validé : +2,5 % si RPE < 5, +1,25 % si RPE ≥ 5 ou absent', () => {
    expect(progressedLoad(kg, fb('fait', 4))).toBe(102.5)
    expect(progressedLoad(kg, fb('fait', 5))).toBe(101.5) // 101,25 arrondi au 0,5
    expect(progressedLoad(kg, fb('fait', null))).toBe(101.5)
  })
  it('non validé : -2,5 % dès RPE 7, sinon identique', () => {
    expect(progressedLoad(kg, fb('fait', 7, '95'))).toBe(97.5) // charge pas atteinte
    expect(progressedLoad(kg, fb('partiel', 8))).toBe(97.5)
    expect(progressedLoad(kg, fb('non fait', 6))).toBe(100)
    expect(progressedLoad(kg, fb('fait', 9, null))).toBe(97.5) // charge non renseignée : pas validé
    expect(progressedLoad(kg, undefined)).toBe(100)
  })
  it('%RM ×1,025 ; poids de corps et charge libre inchangés', () => {
    expect(progressedLoad({ load_value: 80, load_unit: 'pct_rm' }, fb('fait', 3, null))).toBe(82)
    expect(progressedLoad({ load_value: 60, load_unit: 'bw' }, fb('fait', 3))).toBe(60)
    expect(progressedLoad({ load_value: null, load_unit: 'free' }, fb('fait', 3))).toBeNull()
  })
  it('progressedLoads ne transmet que les charges qui changent', () => {
    const ex = (id: string, load_value: number, f?: ReturnType<typeof fb>) => ({
      id, position: 1, block_label: 'A1', sets: 5, reps: '5', load_value, load_unit: 'kg', tempo: null, rest: null, instructions: null,
      exercises: { name: id }, exercise_feedback: f ? [f] : [],
    })
    expect(progressedLoads([{ id: 's', session_date: '2026-10-19', player_id: 'p', planned_exercises: [ex('a', 100, fb('fait', 4)), ex('b', 100)] }]))
      .toEqual({ a: 102.5 })
  })
})

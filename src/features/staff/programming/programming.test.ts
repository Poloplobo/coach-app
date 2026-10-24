import { describe, expect, it } from 'vitest'
import { moveRow, newRow, nextWeek, planByDay, rowsErrors, rowsFromSession, toPayload, weekErrors } from './programming'

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

import { describe, expect, it } from 'vitest'
import { cycleReport, weekReport } from './report'
import type { Log, Player, WeekType } from './load'
import type { StaffMuscuSession } from './muscu'

const player: Player = { id: 'p', first_name: 'Alpha', last_name: 'FICTIF', position: null, injured: false }
const wt: WeekType = { code: 'DEV', name: 'Développement', target_srpe: 3000, srpe_min: 2500, srpe_max: null, volume_min: 0, physique_min: 0, rugby_min: 0, accompagnement_min: 0, ppid_min: 0 }
const weeks = [
  { code: 'S7', label: null, start_date: '2026-10-26', week_type_code: 'DEV', cycle: 'Cycle 2' },
  { code: 'S8', label: null, start_date: '2026-11-02', week_type_code: 'DEV', cycle: 'Cycle 2' },
]
const ex = (id: string, name: string, load: number | null, done: string | null, rpe: number | null, status = 'fait') => ({
  id, position: 1, block_label: 'A1', sets: 5, reps: '3', load_value: load, load_unit: load === null ? 'free' : 'kg', tempo: null, rest: null, instructions: null,
  exercises: { name }, exercise_feedback: done || rpe !== null ? [{ player_id: 'p', rpe, done_load: done, status, comment: null }] : [],
})
const sessions: StaffMuscuSession[] = [
  { id: 's2', session_date: '2026-11-02', player_id: 'p', planned_exercises: [ex('b', 'Développé Couché', 85, '3x88', 8), ex('c', 'Tirage Banc', null, null, null)] },
  { id: 's1', session_date: '2026-10-26', player_id: 'p', planned_exercises: [ex('a', 'Développé Couché', 80, '3x80', 6), ex('d', 'Back Squat', 110, '3x110', 9)] },
]
const log = (date: string, srpe: number, rpe: number | null = 7, type = 'm'): Log =>
  ({ player_id: 'p', session_date: date, activity_type_id: type, duration_min: 60, rpe, srpe, source: 'app', created_at: '' })

describe('cycleReport', () => {
  const r = cycleReport({
    player, weeks, weekTypes: [wt], sessions, muscuTypeId: 'm',
    logs: [log('2026-10-26', 420, 7), log('2026-11-02', 480, 8), log('2026-11-03', 2400, 6, 'rugby')],
    targets: [{ test: 'Développé Couché 1RM', value: 100, label: '1RM', exercise: 'développé couché' }, { test: 'CMJ', value: 50, label: null, exercise: null }],
  })
  it('objectif : charge début → fin dans l\'ordre des dates, % gagné et % de l\'objectif', () => {
    expect(r.objectives[0]).toMatchObject({ start: 80, end: 88, best: 88, gainPct: 10, targetPct: 88 })
    expect(r.objectives[0].points.map(p => p.date)).toEqual(['2026-10-26', '2026-11-02'])
    expect(r.objectives[1]).toMatchObject({ start: null, gainPct: null, targetPct: null }) // test sans exercice lié
  })
  it('plus gros exercices triés par charge, avec RPE moyen ; charge libre sans retour ignorée', () => {
    expect(r.heaviest).toEqual([{ name: 'Back Squat', best: 110, rpe: 9 }, { name: 'Développé Couché', best: 88, rpe: 7 }])
  })
  it('charge hebdo vs cible et période', () => {
    expect(r.weekly).toEqual([{ code: 'S7', total: 420, target: 3000, status: 'sous-charge' }, { code: 'S8', total: 2880, target: 3000, status: 'conforme' }])
    expect(r.period).toBe('S7 → S8 (du 26 oct. au 8 nov.)')
    expect(r.cycle).toBe('Cycle 2')
    expect(r.summary.sessionRpe).toBe(7.5) // RPE de séance muscu seulement
  })
})

describe('weekReport', () => {
  it('joueurs triés par charge, comptes par statut, blessé à part', () => {
    const players = [player, { ...player, id: 'q', first_name: 'Bravo' }, { ...player, id: 'x', first_name: 'Foxtrot', injured: true }]
    const logs = [log('2026-10-26', 3000), { ...log('2026-10-27', 1000), player_id: 'q' }]
    const r = weekReport({ week: weeks[0], wt, players, logs, inProgress: false })
    expect(r.players.map(p => p.name)).toEqual(['FICTIF Alpha', 'FICTIF Bravo', 'FICTIF Foxtrot'])
    expect(r.counts).toEqual({ under: 1, ok: 1, over: 0, injured: 1 })
  })
})

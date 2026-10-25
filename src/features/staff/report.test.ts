import { describe, expect, it } from 'vitest'
import { cycleReport, estimated1RM, weekReport } from './report'
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
    player, weeks, weekTypes: [wt], sessions, muscuTypeId: 'm', today: '2026-12-01', // date figée : semaines terminées
    logs: [log('2026-10-26', 420, 7), log('2026-11-02', 480, 8), log('2026-11-03', 2400, 6, 'rugby')],
    targets: [{ test: 'Développé Couché 1RM', value: 100, label: '1RM', exercise: 'développé couché' }, { test: 'CMJ', value: 50, label: null, exercise: null }],
  })
  it('objectif : 1RM estimée (Epley) début → fin, % gagné et % de l\'objectif sur l\'estimation', () => {
    // 80 kg × 3 → 88 ; 88 kg × 3 → 96,8 arrondi au 0,5 → 97
    expect(r.objectives[0]).toMatchObject({ first: { load: 80, reps: 3, e1rm: 88 }, last: { load: 88, reps: 3, e1rm: 97 }, bestE1rm: 97, gainPct: 10.2, targetPct: 97 })
    expect(r.objectives[0].points.map(p => p.date)).toEqual(['2026-10-26', '2026-11-02'])
    expect(r.objectives[1]).toMatchObject({ first: null, gainPct: null, targetPct: null }) // test sans exercice lié
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

describe('cycleReport : cas limites', () => {
  const base = { player, weeks, weekTypes: [wt], muscuTypeId: 'm', logs: [] as Log[], today: '2026-12-01' }
  const target = (exercise: string | null) => [{ test: 'DC', value: 100, label: null, exercise }]
  const sess = (...exs: ReturnType<typeof ex>[]): StaffMuscuSession[] => [{ id: 's', session_date: '2026-10-26', player_id: 'p', planned_exercises: exs }]

  it('aucun retour de séance : pas de crash, valeurs nulles', () => {
    const r = cycleReport({ ...base, sessions: sess(ex('a', 'Back Squat', null, null, null)), targets: target('Back Squat') })
    expect(r.objectives[0]).toMatchObject({ first: null, last: null, bestE1rm: null, gainPct: null, targetPct: null, points: [] })
    expect(r.heaviest).toEqual([])
    expect(r.summary).toMatchObject({ completionPct: 0, sessionRpe: null, hardest: null })
  })
  it('aucune séance du tout', () => {
    const r = cycleReport({ ...base, sessions: [], targets: target('Back Squat') })
    expect(r.summary.sessions).toBe(0)
    expect(r.heaviest).toEqual([])
  })
  it('un seul point : début = fin, gain 0 %', () => {
    const r = cycleReport({ ...base, sessions: sess(ex('a', 'Back Squat', 100, '3x90', 7)), targets: target('Back Squat') })
    expect(r.objectives[0]).toMatchObject({ first: { load: 90 }, last: { load: 90 }, bestE1rm: 99, gainPct: 0, targetPct: 99 })
  })
  it('charge de départ à 0 ou illisible : pas de division par zéro', () => {
    for (const done of ['0', 'RAS', 'ok']) {
      const r = cycleReport({ ...base, sessions: sess(ex('a', 'Back Squat', null, done, 7)), targets: target('Back Squat') })
      expect(r.objectives[0].gainPct).toBeNull()
      expect(Number.isFinite(r.objectives[0].targetPct ?? 0)).toBe(true)
    }
  })
  it('départ 0 puis charge réelle : on ignore le 0, gain calculé sur la première charge lisible', () => {
    const s: StaffMuscuSession[] = [
      { id: 's1', session_date: '2026-10-26', player_id: 'p', planned_exercises: [ex('a', 'Back Squat', null, '0', 7)] },
      { id: 's2', session_date: '2026-11-02', player_id: 'p', planned_exercises: [ex('b', 'Back Squat', null, '100', 7)] },
    ]
    expect(cycleReport({ ...base, sessions: s, targets: target('Back Squat') }).objectives[0]).toMatchObject({ first: { load: 100 }, last: { load: 100 }, gainPct: 0 })
  })
  it('valeur d\'objectif à 0 : % de l\'objectif null', () => {
    const r = cycleReport({ ...base, sessions: sess(ex('a', 'Back Squat', null, '100', 7)), targets: [{ test: 'DC', value: 0, label: null, exercise: 'Back Squat' }] })
    expect(r.objectives[0].targetPct).toBeNull()
  })
  it('plage d\'une seule semaine', () => {
    const r = cycleReport({ ...base, weeks: [weeks[0]], sessions: [], targets: [], logs: [log('2026-10-26', 500), log('2026-11-02', 900)] })
    expect(r.period).toBe('S7 → S7 (du 26 oct. au 1 nov.)')
    expect(r.weekly).toEqual([{ code: 'S7', total: 500, target: 3000, status: 'sous-charge' }])
  })
  it('aucune semaine : pas de crash', () => {
    const r = cycleReport({ ...base, weeks: [], sessions: [], targets: [] })
    expect(r.weekly).toEqual([])
    expect(r.period).toBe('')
    expect(r.cycle).toBe('')
  })
  it('logs hors plage ignorés de la charge hebdo (veille du lundi, lendemain du dimanche)', () => {
    const r = cycleReport({ ...base, weeks: [weeks[0]], sessions: [], targets: [], logs: [log('2026-10-25', 700), log('2026-10-26', 100), log('2026-11-01', 200), log('2026-11-02', 800)] })
    expect(r.weekly[0].total).toBe(300)
  })
  it('type de semaine inconnu : cible 0, statut null', () => {
    const r = cycleReport({ ...base, weekTypes: [], sessions: [], targets: [], logs: [log('2026-10-26', 500)] })
    expect(r.weekly[0]).toEqual({ code: 'S7', total: 500, target: 0, status: null })
  })
  it('semaine sans log : total 0 (sous-charge)', () => {
    expect(cycleReport({ ...base, sessions: [], targets: [] }).weekly.map(w => w.total)).toEqual([0, 0])
  })
  it('semaine en cours : le statut ne doit pas être évalué (null), comme dans weekReport', () => {
    const r = cycleReport({ ...base, weeks: [{ ...weeks[0], start_date: '2026-10-19' }], sessions: [], targets: [], logs: [log('2026-10-20', 100)], today: '2026-10-21' })
    expect(r.weekly[0].status).toBeNull()
  })
  it('noms d\'exercice en casse différente : objectif et plus gros exercices', () => {
    const s: StaffMuscuSession[] = [
      { id: 's1', session_date: '2026-10-26', player_id: 'p', planned_exercises: [ex('a', 'Back Squat', null, '3x100', 7)] },
      { id: 's2', session_date: '2026-11-02', player_id: 'p', planned_exercises: [ex('b', 'back squat', null, '3x110', 8)] },
    ]
    const r = cycleReport({ ...base, sessions: s, targets: target('BACK SQUAT') })
    expect(r.objectives[0]).toMatchObject({ first: { load: 100 }, last: { load: 110 }, bestE1rm: 121 })
    expect(r.heaviest).toHaveLength(1) // même mouvement, saisi avec deux casses
  })
  it('limite à 5 exercices, triés par charge décroissante', () => {
    const exs = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n, i) => ex(n, n, null, String(50 + i), 7))
    const r = cycleReport({ ...base, sessions: sess(...exs), targets: [] })
    expect(r.heaviest.map(h => h.name)).toEqual(['G', 'F', 'E', 'D', 'C'])
  })
  it('jamais de charge non réalisée : prescription sans retour, « non fait », gainage chronométré, poids de corps', () => {
    const timed = { ...ex('t', 'Gainage', null, '3x45', 7), reps: "45''" }
    const bw = { ...ex('w', 'Pompes', 60, '3x20', 7), load_unit: 'bw' }
    const notDone = ex('n', 'Soulevé de terre', 140, '140', 9, 'non fait')
    const r = cycleReport({ ...base, sessions: sess(ex('a', 'Back Squat', 120, null, null), timed, bw, notDone), targets: [] })
    expect(r.heaviest).toEqual([])
  })
  it('1RM estimée : Epley jusqu\'à 10 reps, 1 rep = la charge, reps non numériques ou > 10 : pas d\'estimation', () => {
    expect(estimated1RM(100, 1)).toBe(100)
    expect(estimated1RM(100, 5)).toBe(116.5) // 116,67 arrondi au 0,5
    expect(estimated1RM(100, 12)).toBeNull()
    expect(estimated1RM(100, null)).toBeNull()
  })
})

describe('weekReport : cas limites', () => {
  it('semaine en cours : statuts null, aucun compté', () => {
    const r = weekReport({ week: weeks[0], wt, players: [player], logs: [log('2026-10-26', 100)], inProgress: true })
    expect(r.players[0].status).toBeNull()
    expect(r.m.groupStatus).toBeNull()
    expect(r.counts).toEqual({ under: 0, ok: 0, over: 0, injured: 0 })
  })
  it('joueur blessé : exclu des comptes par statut et de la moyenne du groupe', () => {
    const inj = { ...player, id: 'x', injured: true }
    const r = weekReport({ week: weeks[0], wt, players: [player, inj], logs: [log('2026-10-26', 3000), { ...log('2026-10-26', 0), player_id: 'x' }], inProgress: false })
    expect(r.counts).toEqual({ under: 0, ok: 1, over: 0, injured: 1 })
    expect(r.m.groupMean).toBe(3000)
  })
  it('aucun joueur ni log : pas de NaN', () => {
    const r = weekReport({ week: weeks[0], wt, players: [], logs: [], inProgress: false })
    expect(r.players).toEqual([])
    expect(Number.isFinite(r.m.groupMean)).toBe(true)
    expect(Number.isFinite(r.m.groupPct)).toBe(true)
  })
  it('sans type de semaine : cible 0, pas de statut, pas de division par zéro', () => {
    const r = weekReport({ week: weeks[0], wt: null, players: [player], logs: [log('2026-10-26', 500)], inProgress: false })
    expect(r.players[0]).toMatchObject({ total: 500, pct: 0, status: null })
  })
  it('log d\'un autre jour de la semaine suivante ignoré', () => {
    const r = weekReport({ week: weeks[0], wt, players: [player], logs: [log('2026-11-02', 3000)], inProgress: false })
    expect(r.players[0].total).toBe(0)
  })
})

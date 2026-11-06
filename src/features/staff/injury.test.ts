import { describe, expect, it } from 'vitest'
import { injuryReport, injurySummary, type InjurySession } from './injury'

const ex = (name: string, pain: number | null) => ({ exercises: { name }, exercise_feedback: pain === null ? [] : [{ pain, status: 'fait' }] })
const s = (id: string, date: string, type: string, exercises: InjurySession['planned_exercises']): InjurySession =>
  ({ id, session_date: date, activity_types: { name: type }, planned_exercises: exercises })

describe('injurySummary', () => {
  const sessions = [
    s('r1', '2026-10-27', 'Réhabilitation', [ex('Isométrie genou', 6), ex('Gainage', null)]),
    s('r2', '2026-11-02', 'Réhabilitation', [ex('Isométrie genou', 4)]),
    s('m2', '2026-11-02', 'Membres sains', [ex('Développé couché', 0)]),
    s('r3', '2026-11-03', 'Réhabilitation', [ex('Isométrie genou', 3)]),
    s('m3', '2026-11-03', 'Membres sains', []),
    s('r4', '2026-11-05', 'Réhabilitation', []), // à venir
  ]
  const r = injurySummary(sessions, new Set(['r2', 'm2', 'r3']), '2026-11-02', '2026-11-03')
  it('séances de la semaine jusqu\'à aujourd\'hui : faites / prévues, par type', () => {
    expect([r.done, r.planned]).toEqual([3, 4])
    expect(r.byType).toEqual([{ type: 'Réhabilitation', planned: 2, done: 2 }, { type: 'Membres sains', planned: 2, done: 1 }])
  })
  it('douleur EVA par exercice dans le temps : dernière valeur et évolution depuis la première', () => {
    expect(r.pain.map(p => [p.name, p.points.map(x => x.pain), p.last, p.trend])).toEqual([
      ['Isométrie genou', [6, 4, 3], 3, -3], ['Développé couché', [0], 0, 0]])
  })
})

describe('injuryReport', () => {
  const types = [{ id: 'r', name: 'Réhabilitation' }, { id: 's', name: 'Membres sains' }, { id: 'c', name: 'Cardio (porté / course)' }, { id: 't', name: 'Reprise terrain' }]
  const ex = (pain: number | null) => ({ exercises: { name: 'Gainage' }, exercise_feedback: [{ pain, status: 'fait' }] })
  const sessions = [
    { id: '1', session_date: '2026-11-02', activity_types: { name: 'Réhabilitation' }, planned_exercises: [ex(4), ex(2)] },
    { id: '2', session_date: '2026-11-03', activity_types: { name: 'Membres sains' }, planned_exercises: [ex(null)] },
    { id: '3', session_date: '2026-11-09', activity_types: { name: 'Réhabilitation' }, planned_exercises: [ex(1)] },
  ]
  const logs = [
    { session_date: '2026-11-02', activity_type_id: 'r', duration_min: 60, rpe: 4, validated_at: 'x' },
    { session_date: '2026-11-04', activity_type_id: 'c', duration_min: 30, rpe: 5, validated_at: null },
    { session_date: '2026-11-05', activity_type_id: 't', duration_min: 45, rpe: 6, validated_at: null },
  ]
  it('semaine par semaine : réhab, membres sains, cardio, terrain, RPE et douleur moyens', () => {
    const r = injuryReport(sessions, logs, types, '2026-11-01', '2026-11-10')
    expect(r.weeks).toEqual([
      { monday: '2026-11-02', rehab: { planned: 1, done: 1 }, healthy: { planned: 1, done: 0 }, cardio: { n: 1, min: 30 }, field: { n: 1, min: 45 }, rpe: 4, pain: 3 },
      { monday: '2026-11-09', rehab: { planned: 1, done: 0 }, healthy: { planned: 0, done: 0 }, cardio: { n: 0, min: 0 }, field: { n: 0, min: 0 }, rpe: null, pain: 1 },
    ])
    expect(r.points.map(p => [p.date, p.rpe, p.pain])).toEqual([['2026-11-02', 4, 3], ['2026-11-03', null, null], ['2026-11-09', null, 1]])
  })
  it('rien avant la blessure ni après aujourd\'hui', () => {
    expect(injuryReport(sessions, logs, types, '2026-11-03', '2026-11-03').points.map(p => p.date)).toEqual(['2026-11-03'])
  })
})

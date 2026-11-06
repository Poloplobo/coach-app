import { describe, expect, it } from 'vitest'
import { injurySummary, type InjurySession } from './injury'

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

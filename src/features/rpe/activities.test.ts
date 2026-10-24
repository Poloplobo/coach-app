import { describe, expect, it } from 'vitest'
import { dayActivities, upcomingByDay, type PlannedRow } from './activities'

const type = (id: string, name: string, requires_rpe = true) => ({ id, name, requires_rpe, default_duration_min: 45 })
const group = (id: string, t: PlannedRow['activity_types'], d: number | null = 30): PlannedRow =>
  ({ id, player_id: null, planned_duration_min: d, activity_types: t })
const indiv = (id: string, t: PlannedRow['activity_types'], d: number | null = 30): PlannedRow =>
  ({ id, player_id: 'p1', planned_duration_min: d, activity_types: t })

const tactique = type('t1', 'Dév. Tactique')
const video = type('t2', 'Vidéo', false)
const muscu = type('t3', 'Musculation')
const rehab = type('t4', 'Réhabilitation')

describe('dayActivities', () => {
  it('reprend les séances du groupe, sans la musculation (étape 5)', () => {
    const list = dayActivities([group('s1', tactique), group('s2', video, 25), indiv('s3', muscu)], { injured: false })
    expect(list).toEqual([
      { plannedSessionId: 's1', activityTypeId: 't1', name: 'Dév. Tactique', requiresRpe: true, durationMin: 30 },
      { plannedSessionId: 's2', activityTypeId: 't2', name: 'Vidéo', requiresRpe: false, durationMin: 25 },
    ])
  })

  it('joueur blessé : seulement son programme individuel', () => {
    const list = dayActivities([group('s1', tactique), indiv('s2', rehab)], { injured: true })
    expect(list.map(a => a.name)).toEqual(['Réhabilitation'])
  })

  it('même activité au groupe et en individuel : une seule ligne, celle du joueur', () => {
    expect(dayActivities([indiv('s2', tactique, 20), group('s1', tactique, 30)], { injured: false }))
      .toEqual([expect.objectContaining({ plannedSessionId: 's2', durationMin: 20 })])
    expect(dayActivities([group('s1', tactique, 30), indiv('s2', tactique, 20)], { injured: false }))
      .toEqual([expect.objectContaining({ plannedSessionId: 's2', durationMin: 20 })])
  })

  it('aperçu « À venir » : jour par jour, musculation comprise, blessé sans le groupe', () => {
    const at = (date: string, r: PlannedRow) => ({ ...r, session_date: date })
    const plan = [at('2026-10-27', group('s3', tactique)), at('2026-10-26', indiv('s1', muscu)), at('2026-10-26', group('s2', video))]
    expect(upcomingByDay(plan, { injured: false }).map(d => [d.date, d.activities.map(a => a.name)]))
      .toEqual([['2026-10-26', ['Musculation', 'Vidéo']], ['2026-10-27', ['Dév. Tactique']]])
    expect(upcomingByDay(plan, { injured: true }).map(d => [d.date, d.activities.map(a => a.name)]))
      .toEqual([['2026-10-26', ['Musculation']]])
  })

  it('durée planifiée absente : durée par défaut de l\'activité', () => {
    expect(dayActivities([group('s1', tactique, null)], { injured: false })[0].durationMin).toBe(45)
  })
})

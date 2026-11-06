import { describe, expect, it } from 'vitest'
import { epidemiology, planProgress, type InjuryRecord } from './medical'

const step = (position: number, planned_days: number, validated_on: string | null = null) =>
  ({ id: `s${position}`, position, title: `Étape ${position}`, criteria: null, planned_days, validated_on })

describe('planProgress', () => {
  it('étape en cours = première non validée ; jours restants déduits de ceux déjà passés dans l\'étape', () => {
    const steps = [step(1, 3, '2026-11-03'), step(2, 7), step(3, 7), step(4, 0)]
    // étape 2 commencée le 03/11 (validation de l'étape 1) ; le 06/11, 3 jours passés : 4 + 7 restants
    expect(planProgress(steps, '2026-10-31', '2026-11-06')).toMatchObject({ current: { position: 2 }, done: 1, total: 4, remainingDays: 11, returnDate: '2026-11-17' })
  })
  it('étape en retard : jamais de jours négatifs ; tout validé : retour atteint', () => {
    expect(planProgress([step(1, 3), step(2, 5)], '2026-10-01', '2026-11-06').remainingDays).toBe(5)
    expect(planProgress([step(1, 3, '2026-11-01')], '2026-10-30', '2026-11-06')).toMatchObject({ current: null, remainingDays: 0, returnDate: null })
  })
})

describe('epidemiology', () => {
  const inj = (over: Partial<InjuryRecord>): InjuryRecord => ({ id: 'i', player_id: 'p', occurred_on: '2026-10-10', ended_on: '2026-10-20', location: 'genou',
    tissue: 'ligament', mechanism: 'plaque', onset: 'soudaine', activity: 'match', recurrence: false, alerts: {}, ...over })
  const list = [
    inj({ id: 'a' }), // 10 jours, match
    inj({ id: 'b', occurred_on: '2026-10-25', ended_on: null, location: 'cheville', activity: 'entrainement', alerts: { alert_days: 3, items_at_1: { fatigue: 2, sommeil: 1 } } }),
    inj({ id: 'c', occurred_on: '2026-08-01' }), // hors période
  ]
  const r = epidemiology(list, { trainingMin: 54_000, matchMin: 6_000 }, '2026-09-01', '2026-11-06', '2026-11-06') // 1000 h
  it('incidence et poids pour 1000 h, match et entraînement séparés', () => {
    expect(r).toMatchObject({ count: 2, open: 1, hours: 1000, incidence: 2, matchIncidence: 10, trainingIncidence: 1.1, daysLost: 22, burden: 22 })
  })
  it('répartitions et alertes avant blessure', () => {
    expect(r.byLocation).toEqual([['genou', 1], ['cheville', 1]])
    expect(r.withAlerts).toBe(1)
    expect(r.items).toEqual([['fatigue', 2], ['sommeil', 1]])
  })
})

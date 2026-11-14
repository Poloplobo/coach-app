import { describe, expect, it } from 'vitest'
import { hm, sleepDuration, sleepStats, streak } from './sleep'

const night = (night_date: string, bed_time: string, asleep_time: string, wake_time: string, awake = 0) =>
  ({ night_date, bed_time, asleep_time, wake_time, duration_min: sleepDuration(asleep_time, wake_time, awake) })

describe('suivi sommeil', () => {
  it('durée : nuit à cheval sur minuit, temps éveillé retiré', () => {
    expect(sleepDuration('23:30', '07:00', 15)).toBe(435)
    expect(sleepDuration('00:45:00', '08:00:00')).toBe(435) // endormi après minuit, format de la base
    expect(sleepDuration('23:00', '23:00')).toBe(0)
    expect(hm(435)).toBe('7 h 15')
  })
  it('7 dernières nuits : moyenne, dette face à 8 h, régularité', () => {
    const nights = [night('2026-11-10', '23:00', '23:30', '07:30'), night('2026-11-11', '23:10', '23:30', '07:30'), night('2026-11-12', '22:50', '23:30', '06:30'),
      night('2026-11-01', '02:00', '03:00', '06:00')] // trop ancienne : ignorée
    expect(sleepStats(nights, '2026-11-12')).toMatchObject({ nights: 3, average: 460, debt: 60, regularity: 'réguliers' })
  })
  it('horaires irréguliers, autour de minuit compris ; moins de 3 nuits : pas de régularité', () => {
    const wild = [night('2026-11-10', '22:00', '22:30', '06:00'), night('2026-11-11', '01:30', '02:00', '10:00'), night('2026-11-12', '23:00', '23:30', '07:00')]
    expect(sleepStats(wild, '2026-11-12')?.regularity).toBe('irréguliers')
    const close = [night('2026-11-10', '23:50', '00:10', '07:00'), night('2026-11-11', '00:10', '00:20', '07:00'), night('2026-11-12', '23:55', '00:10', '07:00')]
    expect(sleepStats(close, '2026-11-12')?.regularity).toBe('réguliers') // 23:50 et 00:10 sont voisines
    expect(sleepStats(wild.slice(0, 2), '2026-11-12')?.regularity).toBeNull()
    expect(sleepStats([], '2026-11-12')).toBeNull()
  })
  it('série d\'une routine : jours d\'affilée, aujourd\'hui pas encore coché ne la casse pas', () => {
    expect(streak(['2026-11-10', '2026-11-11', '2026-11-12'], '2026-11-12')).toBe(3)
    expect(streak(['2026-11-10', '2026-11-11'], '2026-11-12')).toBe(2)
    expect(streak(['2026-11-09', '2026-11-11'], '2026-11-12')).toBe(1)
    expect(streak(['2026-11-08'], '2026-11-12')).toBe(0)
  })
})

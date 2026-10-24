import { describe, expect, it } from 'vitest'
import { addDays, formatDay, isoWeekStart, parisDate } from './week'

describe('parisDate', () => {
  it('dimanche 23 h 30 à Paris reste dimanche (UTC est déjà… dimanche 22 h 30)', () => {
    expect(parisDate(new Date('2026-10-25T22:30:00Z'))).toBe('2026-10-25')
  })

  it('lundi 0 h 30 à Paris est lundi alors qu\'en UTC on est encore dimanche', () => {
    expect(parisDate(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-26')
  })

  it('en été (UTC+2), 1 h 30 à Paris est déjà le lendemain', () => {
    expect(parisDate(new Date('2026-09-14T23:30:00Z'))).toBe('2026-09-15')
  })
})

describe('isoWeekStart', () => {
  it('la semaine commence le lundi, dimanche compris dans la semaine précédente', () => {
    expect(isoWeekStart('2026-10-25')).toBe('2026-10-19') // dimanche
    expect(isoWeekStart('2026-10-26')).toBe('2026-10-26') // lundi
    expect(isoWeekStart('2026-10-28')).toBe('2026-10-26') // mercredi
  })
})

it('addDays traverse les mois et le changement d\'heure', () => {
  expect(addDays('2026-10-24', 3)).toBe('2026-10-27')
  expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
})

it('formatDay écrit le jour en français', () => {
  expect(formatDay('2026-10-26')).toBe('lundi 26 octobre')
})

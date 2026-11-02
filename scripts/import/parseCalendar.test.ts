import { describe, expect, it } from 'vitest'
import { logoSlug, parseCalendar } from './parseCalendar'

describe('parseCalendar', () => {
  it('colonnes repérées par leur titre, dates françaises, ISO ou Excel, domicile / extérieur', () => {
    const r = parseCalendar([
      ['Calendrier Crabos'],
      ['Journée', 'Date', 'Adversaire', 'Lieu'],
      ['J8', '08/11/2026', 'LOU', 'Domicile'],
      ['J9', '2026-11-15', 'Stade Rochelais', 'Extérieur'],
      ['J10', 46348, 'R92', ''],
      [],
    ])
    expect(r.errors).toEqual([])
    expect(r.matches).toEqual([
      { date: '2026-11-08', opponent: 'LOU', home: true, label: 'J8' },
      { date: '2026-11-15', opponent: 'Stade Rochelais', home: false, label: 'J9' },
      { date: '2026-11-22', opponent: 'R92', home: null, label: 'J10' },
    ])
  })
  it('date illisible signalée ; sans en-tête : refusé', () => {
    expect(parseCalendar([['Date', 'Adversaire'], ['bientôt', 'LOU']]).errors[0]).toMatch(/illisible/)
    expect(parseCalendar([['x']]).errors[0]).toMatch(/introuvable/)
  })
  it('logoSlug : accents et espaces', () => { expect(logoSlug('Stade Français Paris')).toBe('stade-francais-paris') })
})

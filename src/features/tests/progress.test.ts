import { describe, expect, it } from 'vitest'
import { goalProgress, latestByTest, progressPct, seasonOf } from './progress'

describe('progressPct', () => {
  it('plus haut = mieux : 80 kg pour un objectif de 100 kg = 80 %', () => {
    expect(progressPct(80, 100, true)).toBe(80)
  })
  it('plus bas = mieux (sprint) : 1,90 s pour un objectif de 1,80 s = 95 %', () => {
    expect(progressPct(1.9, 1.8, false)).toBe(95)
  })
  it('objectif dépassé : plafonné à 100 %', () => {
    expect(progressPct(110, 100, true)).toBe(100)
    expect(progressPct(1.7, 1.8, false)).toBe(100)
  })
  it('valeur nulle ou négative : 0 %, pas de division par zéro', () => {
    expect(progressPct(0, 100, true)).toBe(0)
    expect(progressPct(1.8, 0, false)).toBe(0)
  })
})

it('seasonOf bascule au 1er août', () => {
  expect(seasonOf('2026-09-14')).toBe('2026-2027')
  expect(seasonOf('2027-03-01')).toBe('2026-2027')
  expect(seasonOf('2027-08-01')).toBe('2027-2028')
})

it('latestByTest garde le résultat le plus récent de chaque test', () => {
  const latest = latestByTest([
    { test_id: 'cmj', test_date: '2026-09-14', value: 30 },
    { test_id: 'cmj', test_date: '2027-01-10', value: 34 },
    { test_id: 'dc', test_date: '2026-09-14', value: 80 },
    { test_id: 'cmj', test_date: '2026-11-02', value: 32 },
  ])
  expect(latest.get('cmj')?.value).toBe(34)
  expect(latest.get('dc')?.value).toBe(80)
})

describe('goalProgress', () => {
  const r = (test_date: string, value: number) => ({ test_date, value })
  it('plus haut = mieux : CMJ 36 → 39 pour 45 : encore 6, +3, jauge du départ à l\'objectif', () => {
    expect(goalProgress([r('2026-11-03', 39), r('2026-09-15', 36)], 45, true))
      .toMatchObject({ remaining: 6, gained: 3, reached: false, pct: 33, first: { value: 36 }, last: { value: 39 } })
  })
  it('plus bas = mieux : sprint 1,95 → 1,89 pour 1,80 : encore 0,09 s, gagné 0,06 s', () => {
    const g = goalProgress([r('2026-09-15', 1.95), r('2026-11-03', 1.89)], 1.8, false)!
    expect(g.remaining).toBeCloseTo(0.09)
    expect(g.gained).toBeCloseTo(0.06)
    expect(g.pct).toBe(40)
  })
  it('objectif atteint ou dépassé : reste 0, jauge pleine', () => {
    expect(goalProgress([r('2026-09-15', 55), r('2026-11-03', 60)], 60, true)).toMatchObject({ remaining: 0, reached: true, pct: 100 })
    expect(goalProgress([r('2026-11-03', 1.75)], 1.8, false)).toMatchObject({ reached: true, gained: null })
  })
  it('recul : gain négatif, jauge à 0 ; un seul test : jauge par rapport à l\'objectif', () => {
    expect(goalProgress([r('2026-09-15', 40), r('2026-11-03', 38)], 45, true)).toMatchObject({ gained: -2, pct: 0, remaining: 7 })
    expect(goalProgress([r('2026-11-03', 80)], 100, true)).toMatchObject({ pct: 80, gained: null })
    expect(goalProgress([], 100, true)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { latestByTest, progressPct, seasonOf } from './progress'

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

import { describe, expect, it } from 'vitest'
import { bodyZones, fatiguePercent, levelOf, postureOf } from './fatigue'

it('fatiguePercent : 30/30 = 0 %, 6/30 = 100 %, 18/30 = 50 %', () => {
  expect(fatiguePercent(30)).toBe(0)
  expect(fatiguePercent(6)).toBe(100)
  expect(fatiguePercent(18)).toBe(50)
})

describe('bodyZones', () => {
  it('tête = moyenne sommeil / stress / humeur, tronc = fatigue, bras et jambes = courbatures haut et bas', () => {
    expect(bodyZones({ sleep_quality: 2, stress: 3, mood: 4, fatigue: 5, soreness_upper: 1, soreness_lower: 4 }))
      .toEqual({ head: 3, body: 5, upper: 1, lower: 4 })
  })
  it('historique importé (une seule question de courbatures) : elle vaut pour le haut et le bas', () => {
    expect(bodyZones({ sleep_quality: 3, stress: 3, mood: 3, fatigue: 3, soreness_upper: null, soreness_lower: null, soreness: 2 }))
      .toMatchObject({ upper: 2, lower: 2 })
  })
})

it('levelOf : 4-5 bien, 3 moyen, 1-2 mauvais', () => {
  expect([5, 4, 3, 2, 1].map(levelOf)).toEqual(['ok', 'ok', 'warn', 'bad', 'bad'])
})

it('postureOf : droit sous 34 %, voûté à partir de 67 %', () => {
  expect([0, 33, 34, 66, 67, 100].map(postureOf)).toEqual([0, 0, 1, 1, 2, 2])
})

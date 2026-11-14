import { expect, test } from 'vitest'
import { dayStats, gramsOf, intake, isComplete, parseQuantity } from './nutrition'

test('gramsOf : portion × équivalent en grammes', () => {
  expect(gramsOf(150, 'g')).toBe(150)
  expect(gramsOf(1.5, 'bol')).toBe(375)
  expect(gramsOf(2, 'inconnu')).toBe(0)
})

test('parseQuantity : virgule ou point, rien d\'autre', () => {
  expect(parseQuantity('1,5')).toBe(1.5)
  expect(parseQuantity(' 0.33 ')).toBe(0.33)
  expect(parseQuantity('abc')).toBeNaN()
  expect(parseQuantity('1 000')).toBeNaN()
  expect(parseQuantity('')).toBeNaN()
  expect(gramsOf(parseQuantity('0,33'), 'L')).toBe(330)
})

test('repas complet : protéine, féculent et légume ; un plat composé ne compte pas', () => {
  expect(isComplete(['proteine', 'feculent', 'legume', 'sucre'])).toBe(true)
  expect(isComplete(['plat', 'legume'])).toBe(false)
})

test('dayStats : repas principaux saisis et repas complets du jour', () => {
  const f = (category: string) => ({ category })
  const items = [
    { day: '2026-11-14', meal: 'petit_dejeuner', food: f('feculent') },
    { day: '2026-11-14', meal: 'dejeuner', food: f('proteine') }, { day: '2026-11-14', meal: 'dejeuner', food: f('feculent') },
    { day: '2026-11-14', meal: 'dejeuner', food: f('legume') }, { day: '2026-11-14', meal: 'gouter', food: f('fruit') },
    { day: '2026-11-13', meal: 'diner', food: f('plat') },
  ]
  expect(dayStats(items, '2026-11-14')).toEqual({ mainMeals: 2, complete: 1 })
})

test('intake : apports pour les grammes saisis, aliments sans valeur comptés à part', () => {
  const rice = { kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 }
  expect(intake([{ grams: 200, nutrients: rice }, { grams: 100, nutrients: null }]))
    .toEqual({ kcal: 260, protein: 5, carbs: 56, fat: 1, missing: 1 })
})

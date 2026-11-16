import { expect, it } from 'vitest'
import { nutritionWeek } from './nutritionWeek'

const f = (category: string) => ({ category })
it('7 jours terminés (jusqu\'à hier) : repas, repas complets, eau, avec les repères', () => {
  const today = '2026-11-16'
  const items = [
    { day: '2026-11-15', meal: 'petit_dejeuner', food: f('feculent') },
    { day: '2026-11-15', meal: 'dejeuner', food: f('proteine') }, { day: '2026-11-15', meal: 'dejeuner', food: f('feculent') }, { day: '2026-11-15', meal: 'dejeuner', food: f('legume') },
    { day: '2026-11-15', meal: 'diner', food: f('proteine') },
    { day: '2026-11-10', meal: 'diner', food: f('plat_compose') },
    { day: '2026-11-16', meal: 'dejeuner', food: f('proteine') }, // aujourd'hui : pas compté
    { day: '2026-11-08', meal: 'dejeuner', food: f('proteine') }, // il y a 8 jours : hors fenêtre
  ]
  const water = [{ day: '2026-11-15', ml: 1500 }, { day: '2026-11-15', ml: 750 }, { day: '2026-11-12', ml: 1000 }]
  const w = nutritionWeek(items, water, today)
  expect(w.days.map(d => d.day)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
  expect(w.yesterday).toMatchObject({ day: '2026-11-15', mainMeals: 3, complete: 1, ml: 2250 })
  expect(w.meals).toEqual({ done: 4, of: 21 })
  expect(w.complete).toEqual({ done: 1, of: 14 })
  expect(w.waterAvg).toBe(464) // 3250 mL sur 7 jours
  expect(w.waterDays).toBe(1)
})

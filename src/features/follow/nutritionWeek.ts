import { addDays } from '../../lib/week'
import { WATER_TARGET_ML, dayStats } from './nutrition'

type Item = { day: string; meal: string; food: { category: string } | null }

// Les 7 jours terminés (jusqu'à hier) du journal : repas principaux saisis, déjeuner et dîner complets, eau bue, et les totaux
// face aux repères (3 repas, 2 complets, 2 L par jour). Un jour sans rien de saisi compte comme vide, pas comme ignoré.
export function nutritionWeek(items: Item[], water: { day: string; ml: number }[], today: string) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 7)).map(day => ({
    day, ...dayStats(items, day), ml: water.filter(w => w.day === day).reduce((s, w) => s + w.ml, 0),
  }))
  const sum = (k: 'mainMeals' | 'complete' | 'ml') => days.reduce((s, d) => s + d[k], 0)
  return {
    days,
    yesterday: days[6],
    meals: { done: sum('mainMeals'), of: 21 },
    complete: { done: sum('complete'), of: 14 },
    waterAvg: Math.round(sum('ml') / 7),
    waterDays: days.filter(d => d.ml >= WATER_TARGET_ML).length,
  }
}

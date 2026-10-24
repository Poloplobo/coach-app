import { WELLNESS_MAX } from './items'

// État de fatigue estimé à partir de l'état de forme du jour (représentation indicative, pas un diagnostic)

// Score 30/30 = 0 % de fatigue, 6/30 = 100 %
export const fatiguePercent = (score: number) => Math.round((100 * (WELLNESS_MAX - score)) / (WELLNESS_MAX - 6))

export type WellnessRow = {
  sleep_quality: number; fatigue: number; stress: number; mood: number
  soreness_upper: number | null; soreness_lower: number | null; soreness?: number | null
}

// Zones : tête = sommeil, stress, humeur ; tronc = fatigue ; bras = courbatures haut ; jambes = courbatures bas (1 à 5, 5 = meilleur)
export function bodyZones(w: WellnessRow) {
  return {
    head: Math.round((w.sleep_quality + w.stress + w.mood) / 3),
    body: w.fatigue,
    upper: w.soreness_upper ?? w.soreness ?? 3, // historique : une seule question de courbatures
    lower: w.soreness_lower ?? w.soreness ?? 3,
  }
}

export type Level = 'ok' | 'warn' | 'bad'
export const levelOf = (value: number): Level => (value >= 4 ? 'ok' : value === 3 ? 'warn' : 'bad')

// Posture : droit, légèrement voûté, voûté
export const postureOf = (pct: number) => (pct < 34 ? 0 : pct < 67 ? 1 : 2)

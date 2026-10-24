// 6 items notés de 1 à 5, 5 = meilleur état pour tous (pas d'échelle inversée) ; score sur 30
export const WELLNESS_ITEMS = [
  { key: 'sleep_quality', label: 'Sommeil', low: 'Très mauvais', high: 'Excellent' },
  { key: 'fatigue', label: 'Fatigue', low: 'Épuisé', high: 'Pas fatigué' },
  { key: 'soreness_upper', label: 'Courbatures haut du corps', low: 'Fortes', high: 'Aucune' },
  { key: 'soreness_lower', label: 'Courbatures bas du corps', low: 'Fortes', high: 'Aucune' },
  { key: 'stress', label: 'Stress', low: 'Très stressé', high: 'Détendu' },
  { key: 'mood', label: 'Humeur', low: 'Très mauvaise', high: 'Excellente' },
] as const
export const WELLNESS_MAX = 5 * WELLNESS_ITEMS.length

export type WellnessKey = (typeof WELLNESS_ITEMS)[number]['key']
export type WellnessItems = Record<WellnessKey, number>

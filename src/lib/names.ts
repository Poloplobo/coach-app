import { addDays } from './week'

// Clé de rapprochement des joueurs : « MARTIN Paul », « Paul MARTIN » et « martin_paul » donnent la même clé.
export const nameKey = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .split(/[^a-z]+/).filter(Boolean).sort().join(' ')

// Lundi de S1 + 7 jours par semaine : CONFIG_SEMAINES_PER ne donne aucune date
export const weekStart = (seasonStart: string, weekNumber: number) => addDays(seasonStart, 7 * (weekNumber - 1))

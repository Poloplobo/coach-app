// Indicateurs du suivi sommeil (étape 14). Fonctions pures, testées. Heures au format « HH:MM » ou « HH:MM:SS ».
export type Night = { night_date: string; bed_time: string; asleep_time: string; wake_time: string; duration_min: number }

export const TARGET_MIN = 8 * 60 // shortcut: repère de 8 h pour tous, à remplacer par la cible du joueur quand le staff pourra la régler

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
export const hm = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}`

// Durée dormie : de l'endormissement au réveil (nuit à cheval sur minuit), moins le temps éveillé. Même règle que la base.
export function sleepDuration(asleep: string, wake: string, awakeMin = 0) {
  return Math.max(0, ((minutes(wake) - minutes(asleep) + 1440) % 1440) - awakeMin)
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
const spread = (v: number[]) => { const m = mean(v); return Math.sqrt(mean(v.map(x => (x - m) ** 2))) }
// Une heure du soir et une heure après minuit sont voisines : on compte les minutes à partir de midi
const fromNoon = (t: string) => (minutes(t) + 720) % 1440

// Les 7 dernières nuits saisies (au plus) : durée moyenne, dette face au repère, régularité des horaires.
// Régularité : écart type moyen des heures de coucher et de réveil ; il faut au moins 3 nuits pour en parler.
export function sleepStats(nights: Night[], today: string, target = TARGET_MIN) {
  const from = new Date(Date.parse(`${today}T12:00:00Z`) - 6 * 864e5).toISOString().slice(0, 10)
  const week = nights.filter(n => n.night_date >= from && n.night_date <= today)
  if (!week.length) return null
  const drift = week.length >= 3 ? Math.round((spread(week.map(n => fromNoon(n.bed_time))) + spread(week.map(n => fromNoon(n.wake_time)))) / 2) : null
  return {
    nights: week.length,
    average: Math.round(mean(week.map(n => n.duration_min))),
    debt: week.reduce((sum, n) => sum + Math.max(0, target - n.duration_min), 0),
    drift, // minutes
    regularity: drift === null ? null : drift <= 30 ? 'réguliers' as const : drift <= 60 ? 'un peu variables' as const : 'irréguliers' as const,
  }
}

// Série en cours d'une routine : nuits cochées d'affilée jusqu'à aujourd'hui ; aujourd'hui pas encore coché ne casse pas la série
export function streak(checked: string[], today: string) {
  const days = new Set(checked)
  const day = (back: number) => new Date(Date.parse(`${today}T12:00:00Z`) - back * 864e5).toISOString().slice(0, 10)
  let n = 0
  for (let back = days.has(today) ? 0 : 1; days.has(day(back)); back++) n++
  return n
}

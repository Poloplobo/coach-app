// Dates au format « AAAA-MM-JJ », jour vu de Rouen : la base compare avec paris_today() (current_date est en UTC).
export const parisDate = (now: Date = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Semaine ISO : elle commence le lundi
export function isoWeekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = dimanche
  return addDays(date, -((day + 6) % 7))
}

export const formatDay = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

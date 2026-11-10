// Progression vers un objectif chiffré : le sens du test compte (sprint : plus bas = mieux)
export function progressPct(last: number, target: number, higherIsBetter: boolean): number {
  if (last <= 0 || target <= 0) return 0
  return Math.min(100, Math.round(100 * (higherIsBetter ? last / target : target / last)))
}

// Saison sportive « 2026-2027 » : elle bascule au 1er août
export function seasonOf(date: string): string {
  const [year, month] = date.split('-').map(Number)
  return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

// Dernier résultat de chaque test (les résultats arrivent dans n'importe quel ordre)
export function latestByTest<T extends { test_id: string; test_date: string }>(results: T[]): Map<string, T> {
  const latest = new Map<string, T>()
  for (const r of results) if (!latest.has(r.test_id) || latest.get(r.test_id)!.test_date < r.test_date) latest.set(r.test_id, r)
  return latest
}

// Où en est le joueur sur un objectif, d'après tout l'historique du test : premier et dernier résultat, ce qui reste à gagner
// (0 si atteint), ce qui a été gagné depuis le premier test (négatif si recul), et la jauge du premier test à l'objectif.
// Le sens compte partout (sprint : plus bas = mieux). Un seul résultat, ou départ déjà au-delà de l'objectif : jauge de progressPct.
export function goalProgress(values: { test_date: string; value: number }[], target: number, higherIsBetter: boolean) {
  const sorted = [...values].sort((a, b) => a.test_date.localeCompare(b.test_date))
  const first = sorted[0], last = sorted.at(-1)
  if (!first || !last) return null
  const better = (a: number, b: number) => (higherIsBetter ? a - b : b - a) // de b vers a, dans le bon sens
  const remaining = Math.max(0, better(target, last.value))
  const span = better(target, first.value)
  const pct = remaining === 0 ? 100 : sorted.length > 1 && span > 0
    ? Math.max(0, Math.min(100, Math.round((100 * better(last.value, first.value)) / span)))
    : progressPct(last.value, target, higherIsBetter)
  return { first, last, remaining, gained: sorted.length > 1 ? better(last.value, first.value) : null, reached: remaining === 0, pct }
}

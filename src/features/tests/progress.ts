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

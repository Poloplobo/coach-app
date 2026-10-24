// Supabase renvoie au plus 1000 lignes par requête : on lit page par page, dans un ordre stable, jusqu'au bout.
// Sans ça, une saison complète serait tronquée sans aucune erreur (courbes, ratio et moyennes faux).
export const PAGE = 1000
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

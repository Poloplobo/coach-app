// data/import/objectifs.xlsx, onglet « OBJECTIFS » (ou le premier) : Joueur | Test | Objectif | Libellé (facultatif)
type Rows = string[][]

export type Target = { playerName: string; test: string; value: number; label: string | null }

export function parseTargets(rows: Rows): Target[] {
  const header = rows.findIndex(r => r.some(c => /^joueur$/i.test(c.trim())))
  if (header < 0) throw new Error('objectifs : en-tête « Joueur | Test | Objectif » introuvable')
  const col = (name: RegExp) => rows[header].findIndex(c => name.test(c.trim()))
  const [player, test, value, label] = [col(/^joueur$/i), col(/^test$/i), col(/^objectif$/i), col(/^libell[ée]$/i)]
  if (test < 0 || value < 0) throw new Error('objectifs : colonnes « Test » et « Objectif » obligatoires')

  const errors: string[] = []
  const targets: Target[] = []
  rows.slice(header + 1).forEach((r, i) => {
    if (!r[player]?.trim()) return
    const raw = r[value]?.trim().replace(',', '.') ?? ''
    const n = Number(raw)
    if (!raw || Number.isNaN(n)) return void errors.push(`ligne ${header + i + 2} : objectif illisible « ${r[value] ?? ''} »`)
    targets.push({ playerName: r[player].trim(), test: r[test].trim(), value: n, label: label >= 0 ? r[label]?.trim() || null : null })
  })
  if (errors.length) throw new Error(`objectifs invalides :\n${errors.join('\n')}`)
  return targets
}

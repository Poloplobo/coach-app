// Calendrier des matchs de la saison : Date | Adversaire | Domicile/Extérieur | Journée (ordre et intitulés libres,
// repérés par leur titre). Dates « 08/11/2026 », « 2026-11-08 » ou date Excel.
export type CalendarMatch = { date: string; opponent: string; home: boolean | null; label: string | null }

const iso = (v: unknown): string | null => {
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10) // date Excel
  const t = String(v ?? '').trim()
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

export function parseCalendar(rows: unknown[][]): { matches: CalendarMatch[]; errors: string[] } {
  const h = rows.findIndex(r => r.some(c => /^date/i.test(String(c).trim())) && r.some(c => /adversaire|opposant|club/i.test(String(c))))
  if (h < 0) return { matches: [], errors: ['En-tête « Date | Adversaire | Domicile/Extérieur | Journée » introuvable.'] }
  const head = rows[h].map(c => String(c).trim())
  const col = (re: RegExp) => head.findIndex(c => re.test(c))
  const c = { date: col(/^date/i), opponent: col(/adversaire|opposant|club/i), place: col(/domicile|ext[ée]rieur|lieu|dom/i), label: col(/journ[ée]e|^j$|tour/i) }
  const errors: string[] = []
  const matches: CalendarMatch[] = []
  rows.slice(h + 1).forEach((r, i) => {
    const opponent = String(r[c.opponent] ?? '').trim()
    if (!opponent && !String(r[c.date] ?? '').trim()) return
    const date = iso(r[c.date])
    if (!date || !opponent) return void errors.push(`Ligne ${h + i + 2} : date ou adversaire illisible.`)
    const place = c.place >= 0 ? String(r[c.place] ?? '').trim().toLowerCase() : ''
    const home = /^(d|dom|domicile|home|r[ée]ception)/.test(place) ? true : /^(e|ext|ext[ée]rieur|away|d[ée]placement)/.test(place) ? false : null
    matches.push({ date, opponent, home, label: c.label >= 0 ? String(r[c.label] ?? '').trim() || null : null })
  })
  return { matches, errors }
}

// Nom de fichier du logo : « Lyon OU » → « lyon-ou » (cherché dans data/logos-clubs, servi depuis /logos-clubs)
export const logoSlug = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

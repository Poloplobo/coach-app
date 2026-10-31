// Maxi et objectifs de tout le groupe en un fichier : Joueur | Test | Maxi | Objectif | Libellé (Maxi ou Objectif peuvent
// être vides). Lu dans le navigateur ; xlsx chargé seulement à l'import.
import * as XLSX from 'xlsx'
import { nameKey } from '../../lib/names'

type Player = { id: string; first_name: string; last_name: string; import_name: string | null }
type Test = { id: string; name: string }
export type MaxiRow = { player: Player; test: Test; maxi: number | null; target: number | null; label: string | null }

const num = (v: unknown) => {
  const t = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.')
  if (!t) return { empty: true, value: null }
  const n = Number(t)
  return { empty: false, value: Number.isFinite(n) && n > 0 ? n : null }
}

export function readMaxi(data: ArrayBuffer, ctx: { players: Player[]; tests: Test[] }) {
  const wb = XLSX.read(data)
  const errors: string[] = []
  const sheet = wb.SheetNames.find(n => /maxi|objectif/i.test(n)) ?? wb.SheetNames[0]
  const all = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, defval: '', raw: false })
  const h = all.findIndex(r => r.some(c => /^joueur$/i.test(String(c).trim())) && r.some(c => /^test$/i.test(String(c).trim())))
  if (h < 0) return { rows: [] as MaxiRow[], errors: ['En-tête « Joueur | Test | Maxi | Objectif » introuvable.'] }
  const head = all[h].map(c => String(c).trim())
  const col = (re: RegExp) => head.findIndex(c => re.test(c))
  const c = { player: col(/^joueur$/i), test: col(/^test$/i), maxi: col(/^maxi?$/i), target: col(/^objectif$/i), label: col(/^libell[ée]$/i) }
  if (c.maxi < 0 && c.target < 0) return { rows: [], errors: ['Colonnes « Maxi » et « Objectif » absentes : au moins l\'une des deux est attendue.'] }

  const rows: MaxiRow[] = []
  const seen = new Set<string>()
  all.slice(h + 1).forEach((r, i) => {
    const name = String(r[c.player] ?? '').trim()
    const testName = String(r[c.test] ?? '').trim()
    if (!name && !testName) return
    const line = `Ligne ${h + i + 2}`
    const players = ctx.players.filter(p => [p.import_name ?? '', `${p.first_name} ${p.last_name}`].some(n => n && nameKey(n) === nameKey(name)))
    if (players.length !== 1) return void errors.push(`${line} : « ${name} » ${players.length ? 'correspond à plusieurs joueurs' : 'introuvable dans l\'effectif'}.`)
    const test = ctx.tests.find(t => t.name.trim().toLowerCase() === testName.toLowerCase())
    if (!test) return void errors.push(`${line} : test « ${testName} » inconnu (tests : ${ctx.tests.map(t => t.name).join(', ')}).`)
    const key = `${players[0].id}|${test.id}`
    if (seen.has(key)) return void errors.push(`${line} : ${name} / ${test.name} en double.`)
    seen.add(key)
    const maxi = c.maxi >= 0 ? num(r[c.maxi]) : { empty: true, value: null }
    const target = c.target >= 0 ? num(r[c.target]) : { empty: true, value: null }
    if ((!maxi.empty && maxi.value === null) || (!target.empty && target.value === null)) return void errors.push(`${line} : valeur illisible ou nulle.`)
    if (maxi.empty && target.empty) return
    rows.push({ player: players[0], test, maxi: maxi.value, target: target.value, label: c.label >= 0 ? String(r[c.label] ?? '').trim() || null : null })
  })
  if (!rows.length && !errors.length) errors.push('Aucune valeur à importer.')
  return { rows, errors }
}

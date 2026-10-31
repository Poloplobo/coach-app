// Import de l'export brut du GPS d'un match (une ligne par joueur : POSTE, NOM, KM Total, DHI, Accélération, Vmax,
// Temps (min), GPS, Joueurs). Lu dans le navigateur ; xlsx chargé seulement à l'import.
import * as XLSX from 'xlsx'
import { nameKey } from '../../lib/names'

type Player = { id: string; first_name: string; last_name: string; import_name: string | null }
export type GpsRow = {
  player: Player; position: string; minutes: number; distance_m: number; hi_distance_m: number; accelerations: number; vmax: number | null
}
export type GpsPreview = { sheet: string; rows: GpsRow[]; errors: string[] }

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'))
  return String(v ?? '').trim() === '' || !Number.isFinite(n) ? null : n
}

export function readGps(data: ArrayBuffer, ctx: { players: Player[]; positions: Map<string, string> }): GpsPreview {
  const wb = XLSX.read(data)
  const errors: string[] = []
  // L'onglet du match : celui dont une ligne contient « POSTE » et « NOM »
  const found = wb.SheetNames.map(name => {
    const all = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '' })
    return { name, all, h: all.findIndex(r => r.some(c => /^poste$/i.test(String(c).trim())) && r.some(c => /^nom$/i.test(String(c).trim()))) }
  }).filter(s => s.h >= 0)
  if (found.length !== 1) {
    return { sheet: '', rows: [], errors: [found.length ? `Plusieurs onglets de match (${found.map(f => f.name).join(', ')}) : un match par fichier.` : 'En-tête « POSTE | NOM | KM Total… » introuvable : est-ce bien l\'export GPS du match ?'] }
  }
  const { name: sheet, all, h } = found[0]
  const head = all[h].map(c => String(c).trim())
  const col = (re: RegExp, label: string) => {
    const i = head.findIndex(c => re.test(c))
    if (i < 0) errors.push(`Colonne « ${label} » introuvable.`)
    return i
  }
  const c = {
    position: col(/^poste$/i, 'POSTE'), name: col(/^nom$/i, 'NOM'), distance: col(/^km total/i, 'KM Total'),
    hi: col(/^dhi/i, 'DHI'), accel: col(/^acc[ée]l[ée]ration/i, 'Accélération'), vmax: col(/^vmax/i, 'Vmax'), minutes: col(/^temps/i, 'Temps (min)'),
  }
  const full = head.findIndex(c => /^joueurs?$/i.test(c)) // « Prénom NOM », plus sûr que le seul nom de famille
  if (errors.length) return { sheet, rows: [], errors }

  const byFull = (name: string) => ctx.players.filter(p => [p.import_name ?? '', `${p.first_name} ${p.last_name}`].some(n => n && nameKey(n) === nameKey(name)))
  const byLast = (name: string) => ctx.players.filter(p => nameKey(p.last_name) === nameKey(name))
  const rows: GpsRow[] = []
  const seen = new Set<string>()
  all.slice(h + 1).forEach((r, i) => {
    const last = String(r[c.name] ?? '').trim()
    if (!last) return
    const line = `Ligne ${h + i + 2} (${last})`
    const fullName = full >= 0 ? String(r[full] ?? '').trim() : ''
    // Repli sur le nom de famille seulement si l'export n'a pas de colonne Joueurs : sinon un invité homonyme serait rattaché
    if (full >= 0 && !fullName) return void errors.push(`${line} : colonne « Joueurs » vide (Prénom NOM attendu).`)
    const matches = full >= 0 ? byFull(fullName) : byLast(last)
    if (matches.length !== 1) return void errors.push(`${line} : ${matches.length ? 'plusieurs joueurs de l\'effectif portent ce nom' : 'joueur introuvable dans l\'effectif'}.`)
    const player = matches[0]
    if (seen.has(player.id)) return void errors.push(`${line} : joueur présent deux fois dans l'export.`)
    seen.add(player.id)
    const position = String(r[c.position] ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
    // Vigilance poste : sans groupe de poste, aucun attendu ne peut être calculé
    if (!ctx.positions.has(position)) return void errors.push(`${line} : poste « ${position || 'vide'} » sans attendu au référentiel (postes connus : ${[...ctx.positions.keys()].join(', ')}).`)
    const [minutes, distance, hi, accel, vmax] = [num(r[c.minutes]), num(r[c.distance]), num(r[c.hi]), num(r[c.accel]), num(r[c.vmax])]
    if (minutes === null || minutes <= 0 || minutes > 120) return void errors.push(`${line} : temps de jeu illisible ou hors 1-120 min.`)
    if (distance === null || hi === null || accel === null || distance < 0 || hi < 0 || accel < 0) return void errors.push(`${line} : distance, DHI ou accélérations illisibles.`)
    // Moins de 10 m par minute : valeur en kilomètres (un remplaçant entré tard court ~80 m/min)
    if (distance > 0 && distance / minutes < 10) return void errors.push(`${line} : distance de ${distance} — en kilomètres ? L'export attendu est en mètres.`)
    if (vmax !== null && (vmax <= 0 || vmax >= 45)) return void errors.push(`${line} : Vmax ${vmax} km/h hors plage.`)
    rows.push({ player, position, minutes, distance_m: distance, hi_distance_m: hi, accelerations: accel, vmax })
  })
  if (!rows.length && !errors.length) errors.push('Aucune ligne joueur dans l\'export.')
  return { sheet, rows, errors }
}

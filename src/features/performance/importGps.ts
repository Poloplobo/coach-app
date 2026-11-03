// Import de l'export brut du GPS d'un match (une ligne par joueur : POSTE, NOM, KM Total, DHI, Accélération, Vmax,
// Temps (min), GPS, Joueurs), ou de l'onglet « Données » du classeur GPS - MATCH (plusieurs matchs, colonne Match
// « J1 - R92 » : seules les lignes de la journée choisie sont lues). Lu dans le navigateur ; xlsx chargé seulement à l'import.
import * as XLSX from 'xlsx'
import { nameKey } from '../../lib/names'

type Player = { id: string; first_name: string; last_name: string; import_name: string | null }
export type GpsRow = {
  player: Player; position: string; minutes: number; distance_m: number; hi_distance_m: number; accelerations: number; vmax: number | null
}
export type GpsPreview = { sheet: string; rows: GpsRow[]; errors: string[]; warnings: string[] }

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'))
  return String(v ?? '').trim() === '' || !Number.isFinite(n) ? null : n
}

// Journée de la colonne Match : « J1 - R92 » → « J1 »
const dayOf = (v: unknown) => String(v ?? '').trim().split(/\s*-\s*/)[0].toUpperCase()

export function readGps(data: ArrayBuffer, ctx: { players: Player[]; positions: Map<string, string> }, label: string | null = null): GpsPreview {
  const wb = XLSX.read(data)
  const errors: string[] = []
  const warnings: string[] = [] // non bloquant : joueurs hors effectif ignorés
  // Les onglets de match : ceux dont une ligne contient « POSTE » et « NOM » ; avec une colonne Match, plusieurs matchs
  const found = wb.SheetNames.map(name => {
    const all = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '' })
    const h = all.findIndex(r => r.some(c => /^poste$/i.test(String(c).trim())) && r.some(c => /^nom$/i.test(String(c).trim())))
    return { name, all, h, match: h < 0 ? -1 : all[h].findIndex(c => /^match$/i.test(String(c).trim())) }
  }).filter(s => s.h >= 0)
  const day = label?.trim().toUpperCase()
  // Classeur avec un onglet Données : seules ses lignes de la journée comptent (un onglet d'export à côté, ex. « R92 (1) »,
  // appartient à un autre match et serait importé sous le mauvais)
  const multi = found.find(f => f.match >= 0)
  const history = multi && day && multi.all.slice(multi.h + 1).some(r => dayOf(r[multi.match]) === day) ? multi : null
  const exports = found.filter(f => f.match < 0)
  if (multi && !history) {
    return { sheet: '', rows: [], errors: [`Aucune ligne « ${label?.trim() || 'de journée'} » dans l'onglet « ${multi.name} »${day ? '' : ' : choisis un match du calendrier'}. Pour un nouveau match, importe l'export du GPS seul.`], warnings }
  }
  if (!history && exports.length !== 1) {
    return { sheet: '', rows: [], errors: [exports.length > 1 ? `Plusieurs onglets de match (${exports.map(f => f.name).join(', ')}) : un match par fichier.`
      : 'En-tête « POSTE | NOM | KM Total… » introuvable : est-ce bien l\'export GPS du match ?'], warnings }
  }
  const src = history ?? exports[0]!
  const sheet = history ? `${src.name} (${day})` : src.name
  const { h } = src
  const all = history ? [...src.all.slice(0, h + 1), ...src.all.slice(h + 1).filter(r => dayOf(r[src.match]) === day)] : src.all
  const head = all[h].map(c => String(c).trim())
  const col = (re: RegExp, label: string) => {
    const i = head.findIndex(c => re.test(c))
    if (i < 0) errors.push(`Colonne « ${label} » introuvable.`)
    return i
  }
  const c = {
    position: col(/^poste$/i, 'POSTE'), name: col(/^nom$/i, 'NOM'), distance: col(/^(km total|distance totale)/i, 'KM Total'),
    hi: col(/^(dhi|distance hi)/i, 'DHI'), accel: col(/^acc[ée]l[ée]ration/i, 'Accélération'), vmax: col(/^vmax/i, 'Vmax'), minutes: col(/^temps/i, 'Temps (min)'),
  }
  const full = head.findIndex(c => /^(joueurs?|pr[ée]nom nom)$/i.test(c)) // « Prénom NOM », plus sûr que le seul nom de famille
  if (errors.length) return { sheet, rows: [], errors, warnings }

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
    if (matches.length > 1) return void errors.push(`${line} : plusieurs joueurs de l'effectif portent ce nom.`)
    // Renfort hors effectif (ou nom mal orthographié) : ses lignes sont écartées, les autres joueurs passent
    if (!matches.length) return void warnings.push(`${line} : ${fullName || last} hors effectif, non importé (vérifie l'orthographe si c'est un joueur du groupe).`)
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
  return { sheet, rows, errors, warnings }
}

// Lignes de l'onglet « Données » lues dans la feuille Google : même contrôle que le fichier (readGps)
export function sheetToXlsx(rows: unknown[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Données')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

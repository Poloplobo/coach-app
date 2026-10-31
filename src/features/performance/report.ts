// Contenu des PowerPoint Performance (étape 11g), calqué sur les onglets « Fiche joueur » et « Bilan bloc » du classeur
// « GPS - MATCH ». Fonctions pures, testées : mêmes calculs que l'écran (gps.ts).
import { GPS_COLORS, gpsAnalysis, positionGroup, vmaxTimeline, type GpsColor, type GpsRecord, type GpsReference, type RatingColor } from './gps'

type Match = { id: string; match_date: string; opponent: string; label: string | null }
type Player = { id: string; first_name: string; last_name: string }
type Rating = { match_id: string; player_id: string; rater: 'player' | 'staff'; color: RatingColor }
type Ref = { refs: Map<string, GpsReference>; positions: Map<string, string> }

const round = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null)
const AXES = { distance: 'Distance totale', hi: 'Distance haute intensité', accelerations: 'Accélérations' } as const

const analyse = (r: GpsRecord, ref: Ref) => gpsAnalysis(r, ref.refs.get(positionGroup(r.position, ref.positions) ?? '') ?? null)
const note = (ratings: Rating[], match: string, player: string, rater: Rating['rater']) =>
  ratings.find(x => x.match_id === match && x.player_id === player && x.rater === rater)?.color ?? null

// Rendu équipe d'un match : tous les joueurs (avec ou sans GPS), couleur GPS, notes, moyennes par groupe de poste
export function matchReport(input: { match: Match; players: Player[]; records: GpsRecord[]; ratings: Rating[]; ref: Ref; allRecords: GpsRecord[]; matches: Match[] }) {
  const { match, players, records, ratings, ref } = input
  const dateOf = new Map(input.matches.map(m => [m.id, m.match_date]))
  const rows = players.map(p => {
    const record = records.find(r => r.match_id === match.id && r.player_id === p.id) ?? null
    const analysis = record ? analyse(record, ref) : null
    const vmax = record ? vmaxTimeline(input.allRecords.filter(r => r.player_id === p.id).map(r => ({ date: dateOf.get(r.match_id) ?? '', vmax: r.vmax })))
      .find(v => v.date === match.match_date) ?? null : null
    return { player: p, record, analysis, group: record ? positionGroup(record.position, ref.positions) : null, record_vmax: !!vmax?.record,
      own: note(ratings, match.id, p.id, 'player'), staff: note(ratings, match.id, p.id, 'staff') }
  }).sort((a, b) => (b.analysis?.filled ?? -1) - (a.analysis?.filled ?? -1) || a.player.last_name.localeCompare(b.player.last_name))
  const analysed = rows.filter(r => r.analysis)
  const groups = [...new Set(analysed.map(r => r.group!))].map(group => {
    const g = analysed.filter(r => r.group === group).map(r => r.analysis!)
    return { group, players: g.length, distance: round(mean(g.map(a => a.pct.distance))!), hi: round(mean(g.map(a => a.pct.hi))!),
      accelerations: round(mean(g.map(a => a.pct.accelerations))!), filled: round(mean(g.map(a => a.filled))!, 1) }
  })
  const count = (pick: (r: typeof rows[number]) => RatingColor | null | undefined) => Object.fromEntries(GPS_COLORS.map(c => [c, rows.filter(r => pick(r) === c).length])) as Record<GpsColor, number>
  return {
    rows, groups,
    withGps: rows.filter(r => r.record).length,
    gpsColors: count(r => r.analysis?.color), ownColors: count(r => r.own), staffColors: count(r => r.staff),
    // Regards croisés : même couleur pour le joueur et le staff
    agreement: rows.filter(r => r.own && r.staff && r.own === r.staff).length,
    bothRated: rows.filter(r => r.own && r.staff).length,
  }
}

// Bilan individuel sur un bloc de matchs : historique, moyennes, attendus remplis, couleur du bloc, axe de travail
export function playerReport(input: { player: Player; matches: Match[]; records: GpsRecord[]; ratings: Rating[]; ref: Ref }) {
  const { player, ref, ratings } = input
  const matches = [...input.matches].sort((a, b) => a.match_date.localeCompare(b.match_date))
  const own = input.records.filter(r => r.player_id === player.id)
  const vmax = vmaxTimeline(own.map(r => ({ date: matches.find(m => m.id === r.match_id)?.match_date ?? '', vmax: r.vmax })))
  const history = matches.map(m => {
    const record = own.find(r => r.match_id === m.id) ?? null
    return { match: m, record, analysis: record ? analyse(record, ref) : null, vmax: vmax.find(v => v.date === m.match_date) ?? null,
      own: note(ratings, m.id, player.id, 'player'), staff: note(ratings, m.id, player.id, 'staff') }
  })
  const played = history.filter(h => h.record)
  const analysed = history.filter(h => h.analysis).map(h => h.analysis!)
  const avg = (pick: (r: GpsRecord) => number) => (played.length ? round(mean(played.map(h => pick(h.record!)))!) : null)
  const pctAvg = (k: keyof typeof AXES) => (analysed.length ? round(mean(analysed.map(a => a.pct[k]))!) : null)
  const filled = analysed.reduce((s, a) => s + a.filled, 0)
  const meanFilled = analysed.length ? filled / analysed.length : null
  const pcts = { distance: pctAvg('distance'), hi: pctAvg('hi'), accelerations: pctAvg('accelerations') }
  // Axe de travail : l'attendu le moins atteint en moyenne sur le bloc
  const weakest = analysed.length ? (Object.keys(AXES) as (keyof typeof AXES)[]).sort((a, b) => pcts[a]! - pcts[b]!)[0] : null
  return {
    history, played: played.length, analysed: analysed.length,
    minutes: avg(r => r.minutes), distance: avg(r => r.distance_m), hi: avg(r => r.hi_distance_m), accelerations: avg(r => r.accelerations),
    vmaxMax: own.some(r => r.vmax) ? Math.max(...own.map(r => r.vmax ?? 0)) : null,
    pcts, filled, possible: analysed.length * 3, meanFilled: meanFilled === null ? null : round(meanFilled, 1),
    // Couleur du bloc : moyenne des attendus remplis par match, arrondie (1,5 → vert)
    color: meanFilled === null ? null : GPS_COLORS[Math.round(meanFilled)],
    axis: weakest ? AXES[weakest] : null,
  }
}

// Rendu collectif sur un bloc de matchs : le bilan de chaque joueur sur le bloc (playerReport), la répartition des
// couleurs du bloc, et les moyennes par groupe de poste (groupe du dernier match analysé de chaque joueur)
export function teamBlockReport(input: { matches: Match[]; players: Player[]; records: GpsRecord[]; ratings: Rating[]; ref: Ref }) {
  const { ref } = input
  const players = input.players.map(player => {
    const r = playerReport({ ...input, player })
    const last = [...r.history].reverse().find(h => h.analysis)
    return { player, report: r, group: last?.record ? positionGroup(last.record.position, ref.positions) : null }
  }).sort((a, b) => (b.report.meanFilled ?? -1) - (a.report.meanFilled ?? -1) || a.player.last_name.localeCompare(b.player.last_name))
  const analysed = players.filter(p => p.report.analysed > 0)
  const groups = [...new Set(analysed.map(p => p.group!))].map(group => {
    const g = analysed.filter(p => p.group === group).map(p => p.report)
    const avg = (k: 'distance' | 'hi' | 'accelerations') => round(mean(g.map(r => r.pcts[k]!))!)
    return { group, players: g.length, distance: avg('distance'), hi: avg('hi'), accelerations: avg('accelerations'), filled: round(mean(g.map(r => r.meanFilled!))!, 1) }
  })
  return {
    matches: [...input.matches].sort((a, b) => a.match_date.localeCompare(b.match_date)),
    players, groups,
    withGps: players.filter(p => p.report.played > 0).length,
    blockColors: Object.fromEntries(GPS_COLORS.map(c => [c, analysed.filter(p => p.report.color === c).length])) as Record<GpsColor, number>,
    filled: analysed.reduce((s, p) => s + p.report.filled, 0),
    possible: analysed.reduce((s, p) => s + p.report.possible, 0),
  }
}

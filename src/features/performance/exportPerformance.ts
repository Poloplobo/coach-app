// PowerPoint Performance (étape 11g) : une diapo par rendu, dans le style des écrans Performance et Accueil de l'app :
// cartes de chiffres clés, blocs arrondis, données brutes avec barre comparée au meilleur, coqs de couleur.
// - Collectif d'un match : GPS bruts de tout l'effectif, couleur GPS (coqs), top Vmax.
// - Collectif d'un bloc : moyennes de chaque joueur, couleur du bloc, coq GPS de chaque match.
// - Individuel (un match, un bloc ou un cycle) : profil, chiffres bruts, jauges des attendus, évolution, coqs par match.
// GPS seulement : les notes de match n'y figurent pas (espace Match, décision du 02/11/2026).
import type PptxGenJS from 'pptxgenjs'
import { formatDay } from '../../lib/week'
import { C, DISPLAY, FONT, asset, chart, deck, empty, slide } from '../staff/exportPptx'
import { COLOR_LABEL, GPS_COLORS, type RatingColor } from './gps'
import type { matchReport, playerReport, teamBlockReport } from './report'

const COLOR_HEX: Record<RatingColor, string> = { rouge: C.red, jaune: C.gold, vert: C.green, bleu: '3B82F6', gris: C.grey } // gris : pas évaluable
const RING = '2E2E2E' // liseré discret des blocs (ring-line/60 de l'app)
const n = (v: number | null, unit = '') => (v === null ? '—' : `${v.toLocaleString('fr-FR')}${unit}`)
const matchName = (m: { opponent: string; label: string | null; match_date: string }) => `${m.label ? `${m.label} · ` : ''}${m.opponent} · ${formatDay(m.match_date)}`
const AXES = [['distance', 'Distance totale'], ['hi', 'Haute intensité (> 21 km/h)'], ['accelerations', 'Accélérations']] as const
const mean = (v: number[]) => (v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null)
const plural = (k: number, w: string) => `${k} ${w}${k > 1 ? 's' : ''}`

type Slide = PptxGenJS.Slide
type Pptx = PptxGenJS
type Coqs = Record<RatingColor, string | null>

// Coqs teintés (public/coq/ppt-<couleur>.png, tirés de la silhouette de l'app), lus sur notre domaine ; sinon pastilles
const loadCoqs = async (): Promise<Coqs> =>
  Object.fromEntries(await Promise.all((['rouge', 'jaune', 'vert', 'bleu', 'gris'] as const).map(async c => [c, await asset(`/coq/ppt-${c}.png`)]))) as Coqs

function coq(s: Slide, pptx: Pptx, coqs: Coqs, c: RatingColor | null, cx: number, cy: number, size = 0.22) {
  const img = c && coqs[c]
  if (img) s.addImage({ data: img, x: cx - size / 2, y: cy - size / 2, w: size, h: size })
  else s.addShape(pptx.ShapeType.ellipse, { x: cx - size / 3, y: cy - size / 3, w: (2 * size) / 3, h: (2 * size) / 3,
    fill: { color: c ? COLOR_HEX[c] : C.bg }, line: { color: c ? COLOR_HEX[c] : C.line, width: 1 } })
}

// Bloc arrondi (rounded-2xl bg-surface ring de l'app)
const panel = (s: Slide, pptx: Pptx, x: number, y: number, w: number, h: number) =>
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, fill: { color: C.surface }, line: { color: RING, width: 0.75 }, rectRadius: 0.14 })

// Carte de chiffre clé : libellé, grand chiffre et unité, précision en dessous (comme StatCard)
function tile(s: Slide, pptx: Pptx, x: number, y: number, w: number, label: string, value: string, unit: string, sub?: string, accent?: string) {
  panel(s, pptx, x, y, w, 0.98)
  s.addText(label, { x: x + 0.18, y: y + 0.1, w: w - 0.3, h: 0.24, fontFace: FONT, fontSize: 10, color: C.muted, margin: 0 })
  s.addText([
    { text: value, options: { fontFace: DISPLAY, fontSize: 26, bold: true, color: accent ?? C.ink } },
    { text: unit ? ` ${unit}` : '', options: { fontFace: DISPLAY, fontSize: 13, color: C.muted } },
  ], { x: x + 0.18, y: y + 0.32, w: w - 0.3, h: 0.42, margin: 0, valign: 'middle', fit: 'shrink' })
  if (sub) s.addText(sub, { x: x + 0.18, y: y + 0.72, w: w - 0.3, h: 0.2, fontFace: FONT, fontSize: 8, color: C.muted, margin: 0, fit: 'shrink' })
}
const tiles = (s: Slide, pptx: Pptx, x: number, y: number, w: number, items: Parameters<typeof tile> extends [unknown, unknown, unknown, unknown, unknown, ...infer R] ? R[] : never) => {
  const tw = (w - 0.15 * (items.length - 1)) / items.length
  items.forEach((it, i) => tile(s, pptx, x + i * (tw + 0.15), y, tw, ...it))
}

// Titre de bloc en or + phrase d'aide (Card help de l'app)
function heading(s: Slide, x: number, y: number, w: number, title: string, help?: string) {
  s.addText(title, { x, y, w, h: 0.26, fontFace: DISPLAY, fontSize: 14, bold: true, color: C.ink, margin: 0 })
  if (help) s.addText(help, { x, y: y + 0.25, w, h: 0.22, fontFace: FONT, fontSize: 8, color: C.muted, margin: 0, fit: 'shrink' })
}

// Valeur brute + barre comparée au meilleur + % de l'attendu en petit (vert et coché quand il est atteint) : Metric de l'app
function metric(s: Slide, pptx: Pptx, x: number, y: number, h: number, value: number | null, max: number, pct: number | null | undefined, font: number, star = false) {
  if (value === null) { s.addText('—', { x, y, w: 0.55, h, fontFace: FONT, fontSize: font, color: C.muted, align: 'right', margin: 0, valign: 'middle' }); return }
  const ok = pct != null && pct >= 100
  s.addText(value.toLocaleString('fr-FR'), { x, y, w: 0.55, h, fontFace: FONT, fontSize: font, bold: true, color: C.ink, align: 'right', margin: 0, valign: 'middle' })
  const bx = x + 0.62, bw = 0.5, by = y + h / 2 - 0.03
  s.addShape(pptx.ShapeType.roundRect, { x: bx, y: by, w: bw, h: 0.06, fill: { color: C.bg }, line: { color: C.bg }, rectRadius: 0.03 })
  if (max > 0) s.addShape(pptx.ShapeType.roundRect, { x: bx, y: by, w: Math.max(0.04, (bw * value) / max), h: 0.06,
    fill: { color: ok ? C.green : C.muted }, line: { color: ok ? C.green : C.muted }, rectRadius: 0.03 })
  const note = star ? '★' : pct != null ? `${ok ? '✓' : ''}${pct} %` : ''
  if (note) s.addText(note, { x: bx + bw + 0.05, y, w: 0.42, h, fontFace: FONT, fontSize: font - 2, bold: ok || star, color: star ? C.gold : ok ? C.green : C.muted, margin: 0, valign: 'middle' })
}

// Anneau de répartition des couleurs + légende en coqs (Couleur GPS de l'app)
function colorRing(s: Slide, pptx: Pptx, coqs: Coqs, x: number, y: number, w: number, counts: Record<string, number>, center: string, centerLabel: string) {
  const colors = GPS_COLORS.filter(c => counts[c] > 0)
  if (colors.length) s.addChart(pptx.ChartType.doughnut, [{ name: 'Couleur GPS', labels: colors.map(c => COLOR_LABEL[c]), values: colors.map(c => counts[c]) }],
    { ...chart, x, y, w: 1.5, h: 1.5, holeSize: 62, chartColors: colors.map(c => COLOR_HEX[c]), dataBorder: { pt: 1.5, color: C.surface },
      plotArea: { fill: { color: C.surface } }, chartArea: { fill: { color: C.surface } }, showLegend: false, showValue: false, showPercent: false })
  s.addText([
    { text: center, options: { fontFace: DISPLAY, fontSize: 22, bold: true, color: C.ink, breakLine: true } },
    { text: centerLabel, options: { fontFace: FONT, fontSize: 8, color: C.muted } },
  ], { x, y: y + 0.45, w: 1.5, h: 0.6, align: 'center', valign: 'middle', margin: 0 })
  GPS_COLORS.slice().reverse().forEach((c, i) => {
    const ly = y + 0.12 + i * 0.32
    coq(s, pptx, coqs, c, x + 1.75, ly + 0.12, 0.24)
    s.addText(COLOR_LABEL[c], { x: x + 1.93, y: ly, w: w - 2.25, h: 0.24, fontFace: FONT, fontSize: 9, color: counts[c] ? C.soft : C.muted, margin: 0, valign: 'middle', fit: 'shrink' })
    s.addText(String(counts[c]), { x: x + w - 0.35, y: ly, w: 0.3, h: 0.24, fontFace: FONT, fontSize: 9, bold: true, color: counts[c] ? C.ink : C.muted, align: 'right', margin: 0, valign: 'middle' })
  })
}

// Lignes de joueurs : alternance discrète, police qui suit la hauteur disponible
const rowLayout = (count: number, top: number, bottom: number) => {
  const h = Math.min(0.27, (bottom - top) / Math.max(1, count))
  return { h, font: h < 0.19 ? 7 : h < 0.23 ? 8 : 9 }
}

export async function downloadMatchReport(r: ReturnType<typeof matchReport>, match: { opponent: string; label: string | null; match_date: string }, fileName: string) {
  const d = await deck()
  const { pptx } = d
  const coqs = await loadCoqs()
  const rows = r.rows.filter(x => x.record)
  const missing = r.rows.filter(x => !x.record)
  const analysed = rows.filter(x => x.analysis)
  const full = analysed.filter(x => x.analysis!.filled === 3).length
  const fastest = [...rows].filter(x => x.record!.vmax != null).sort((a, b) => b.record!.vmax! - a.record!.vmax!)
  const s = slide(d, `Rendu collectif — ${match.opponent}`,
    `${matchName(match)} · ${plural(rows.length, 'joueur')} avec GPS, ${full} rempli${full > 1 ? 'ssent' : 't'} les 3 attendus de leur poste`)

  tiles(s, pptx, 0.6, 1.6, 12.13, [
    ['Joueurs avec GPS', String(rows.length), `/ ${r.rows.length}`, `${full} avec les 3 attendus remplis`],
    ['Distance moyenne', n(mean(rows.map(x => x.record!.distance_m))), 'm', 'par joueur avec GPS'],
    ['Haute intensité moyenne', n(mean(rows.map(x => x.record!.hi_distance_m))), 'm', 'au-dessus de 21 km/h'],
    ['Vmax du match', fastest[0] ? n(fastest[0].record!.vmax) : '—', 'km/h', fastest[0] ? `${fastest[0].player.last_name} ${fastest[0].player.first_name}${fastest[0].record_vmax ? ' · record' : ''}` : undefined, C.gold],
  ])

  // Données brutes de tout l'effectif (ordre du rapport : du plus complet au moins complet)
  const px = 0.6, pw = 9.0, py = 2.75, ph = 4.1
  panel(s, pptx, px, py, pw, ph)
  heading(s, px + 0.2, py + 0.12, pw - 0.4, 'GPS du match', 'Données brutes. Barre : comparée au meilleur du match. En petit : % de l\'attendu au poste (ramené à 70 min), coché quand il est atteint.')
  const col = { name: px + 0.2, min: px + 2.15, m: [px + 2.55, px + 4.15, px + 5.75, px + 7.35] }
  const hy = py + 0.66
  const head = (t: string, x: number, w: number, align: 'left' | 'center' | 'right' = 'left') =>
    s.addText(t, { x, y: hy, w, h: 0.2, fontFace: FONT, fontSize: 8, color: C.muted, align, margin: 0 })
  head('Joueur', col.name, 1.9); head('Min', col.min, 0.35, 'right')
  ;['Distance (m)', 'Haute int. (m)', 'Accél.', 'Vmax (km/h)'].forEach((t, i) => head(t, col.m[i], 1.5))
  head('GPS', px + pw - 0.55, 0.4, 'center')
  const { h, font } = rowLayout(rows.length, hy + 0.24, py + ph - (missing.length ? 0.32 : 0.1))
  const best = { d: Math.max(0, ...rows.map(x => x.record!.distance_m)), hi: Math.max(0, ...rows.map(x => x.record!.hi_distance_m)),
    a: Math.max(0, ...rows.map(x => x.record!.accelerations)), v: Math.max(0, ...rows.map(x => x.record!.vmax ?? 0)) }
  if (!rows.length) empty(s, 'Aucun GPS importé pour ce match.')
  rows.forEach((x, i) => {
    const y = hy + 0.24 + i * h, rec = x.record!
    if (i % 2) s.addShape(pptx.ShapeType.rect, { x: px + 0.1, y, w: pw - 0.2, h, fill: { color: '2A2A2A' }, line: { color: '2A2A2A' } })
    s.addText([
      { text: `${x.player.last_name} ${x.player.first_name}`, options: { bold: true, color: C.ink } },
      { text: `  ${rec.position.toLowerCase()}`, options: { color: C.muted, fontSize: font - 2 } },
    ], { x: col.name, y, w: 1.95, h, fontFace: FONT, fontSize: font, margin: 0, valign: 'middle', fit: 'shrink' })
    s.addText(String(rec.minutes), { x: col.min, y, w: 0.35, h, fontFace: FONT, fontSize: font, color: C.soft, align: 'right', margin: 0, valign: 'middle' })
    metric(s, pptx, col.m[0], y, h, rec.distance_m, best.d, x.analysis?.pct.distance, font)
    metric(s, pptx, col.m[1], y, h, rec.hi_distance_m, best.hi, x.analysis?.pct.hi, font)
    metric(s, pptx, col.m[2], y, h, rec.accelerations, best.a, x.analysis?.pct.accelerations, font)
    metric(s, pptx, col.m[3], y, h, rec.vmax, best.v, null, font, x.record_vmax)
    if (x.analysis) coq(s, pptx, coqs, x.analysis.color, px + pw - 0.35, y + h / 2, Math.min(0.24, h))
    else s.addText(rec.minutes < 20 ? '< 20 min' : '—', { x: px + pw - 0.6, y, w: 0.5, h, fontFace: FONT, fontSize: font - 2, color: C.muted, align: 'center', margin: 0, valign: 'middle' })
  })
  if (missing.length) s.addText(`Sans GPS : ${missing.map(x => `${x.player.last_name} ${x.player.first_name}`).join(', ')}`,
    { x: px + 0.2, y: py + ph - 0.3, w: pw - 0.4, h: 0.22, fontFace: FONT, fontSize: 8, color: C.muted, margin: 0, fit: 'shrink' })

  // Colonne de droite : couleur GPS (anneau + coqs), top 5 Vmax
  const rx = 9.75, rw = 2.98
  panel(s, pptx, rx, py, rw, 2.25)
  heading(s, rx + 0.18, py + 0.12, rw - 0.3, 'Couleur GPS', 'Attendus du poste remplis sur 3')
  colorRing(s, pptx, coqs, rx + 0.1, py + 0.62, rw - 0.15, r.gpsColors, String(analysed.length), 'analysés')
  panel(s, pptx, rx, py + 2.4, rw, ph - 2.4)
  heading(s, rx + 0.18, py + 2.52, rw - 0.3, 'Vmax du match', '★ : record personnel battu')
  fastest.slice(0, 5).forEach((x, i) => {
    const y = py + 2.98 + i * 0.21
    s.addText([
      { text: `${i + 1}  `, options: { color: C.muted, bold: true } },
      { text: `${x.player.last_name} ${x.player.first_name}`, options: { color: C.ink, bold: true } },
    ], { x: rx + 0.18, y, w: rw - 1.25, h: 0.24, fontFace: FONT, fontSize: 9, margin: 0, valign: 'middle', fit: 'shrink' })
    s.addText(`${n(x.record!.vmax)} km/h${x.record_vmax ? ' ★' : ''}`, { x: rx + rw - 1.1, y, w: 0.95, h: 0.24, fontFace: FONT, fontSize: 9, color: x.record_vmax ? C.gold : C.soft, align: 'right', margin: 0, valign: 'middle' })
  })

  await pptx.writeFile({ fileName })
}

// Collectif d'un bloc : moyennes de chaque joueur (brutes + % de l'attendu), couleur du bloc, coq GPS de chaque match
export async function downloadTeamBlockReport(r: ReturnType<typeof teamBlockReport>, fileName: string) {
  const d = await deck()
  const { pptx } = d
  const coqs = await loadCoqs()
  const first = r.matches[0], last = r.matches.at(-1)
  const rows = r.players.filter(x => x.report.played > 0)
  const absent = r.players.filter(x => x.report.played === 0)
  const fastest = [...rows].filter(x => x.report.vmaxMax).sort((a, b) => b.report.vmaxMax! - a.report.vmaxMax!)[0]
  const s = slide(d, 'Rendu collectif — bloc de matchs',
    first && last ? `${plural(r.matches.length, 'match')} · ${formatDay(first.match_date)} → ${formatDay(last.match_date)} · moyennes de chaque joueur sur les matchs avec GPS, ramenées à 70 min` : 'Aucun match dans le bloc')

  tiles(s, pptx, 0.6, 1.6, 12.13, [
    ['Matchs du bloc', String(r.matches.length), '', r.matches.map(m => m.label ?? m.opponent).join(' · ')],
    ['Joueurs avec GPS', String(r.withGps), `/ ${r.players.length}`, 'au moins un match sur le bloc'],
    ['Attendus remplis', r.possible ? `${r.filled}/${r.possible}` : '—', '', r.possible ? `${Math.round((100 * r.filled) / r.possible)} % des attendus du bloc` : undefined, C.green],
    ['Vmax du bloc', fastest ? n(fastest.report.vmaxMax) : '—', 'km/h', fastest ? `${fastest.player.last_name} ${fastest.player.first_name}` : undefined, C.gold],
  ])

  const px = 0.6, pw = 9.0, py = 2.75, ph = 4.1
  panel(s, pptx, px, py, pw, ph)
  heading(s, px + 0.2, py + 0.12, pw - 0.4, 'Moyennes du bloc par joueur', 'Moyenne brute par match ; barre comparée au meilleur ; en petit : % de l\'attendu (coché si atteint). Coqs : couleur du bloc, puis de chaque match.')
  const shown = r.matches.slice(-6) // au-delà de 6 matchs, les 6 derniers : la régularité se lit encore
  const col = { name: px + 0.2, nb: px + 2.15, m: [px + 2.6, px + 4.2, px + 5.8], bloc: px + 7.55, games: px + 7.95 }
  const step = Math.min(0.24, 0.95 / Math.max(1, shown.length))
  const hy = py + 0.66
  const head = (t: string, x: number, w: number, align: 'left' | 'center' | 'right' = 'left', size = 8) =>
    s.addText(t, { x, y: hy, w, h: 0.2, fontFace: FONT, fontSize: size, color: C.muted, align, margin: 0 })
  head('Joueur', col.name, 1.9); head('Matchs', col.nb, 0.45, 'center')
  ;['Distance (m)', 'Haute int. (m)', 'Accél.'].forEach((t, i) => head(t, col.m[i], 1.5))
  head('Bloc', col.bloc - 0.2, 0.4, 'center')
  shown.forEach((m, i) => head(m.label ?? m.opponent.slice(0, 3), col.games + i * step, step, 'center', 6))
  const { h, font } = rowLayout(rows.length, hy + 0.24, py + ph - (absent.length ? 0.32 : 0.1))
  const best = { d: Math.max(0, ...rows.map(x => x.report.distance ?? 0)), hi: Math.max(0, ...rows.map(x => x.report.hi ?? 0)), a: Math.max(0, ...rows.map(x => x.report.accelerations ?? 0)) }
  if (!rows.length) empty(s, 'Aucun GPS importé sur ce bloc de matchs.')
  rows.forEach((x, i) => {
    const y = hy + 0.24 + i * h, rep = x.report
    if (i % 2) s.addShape(pptx.ShapeType.rect, { x: px + 0.1, y, w: pw - 0.2, h, fill: { color: '2A2A2A' }, line: { color: '2A2A2A' } })
    s.addText([
      { text: `${x.player.last_name} ${x.player.first_name}`, options: { bold: true, color: C.ink } },
      { text: x.group ? `  ${x.group.toLowerCase()}` : '', options: { color: C.muted, fontSize: font - 2 } },
    ], { x: col.name, y, w: 1.95, h, fontFace: FONT, fontSize: font, margin: 0, valign: 'middle', fit: 'shrink' })
    s.addText(`${rep.played}/${rep.history.length}`, { x: col.nb, y, w: 0.45, h, fontFace: FONT, fontSize: font, color: C.soft, align: 'center', margin: 0, valign: 'middle' })
    metric(s, pptx, col.m[0], y, h, rep.distance, best.d, rep.pcts.distance, font)
    metric(s, pptx, col.m[1], y, h, rep.hi, best.hi, rep.pcts.hi, font)
    metric(s, pptx, col.m[2], y, h, rep.accelerations, best.a, rep.pcts.accelerations, font)
    coq(s, pptx, coqs, rep.color, col.bloc, y + h / 2, Math.min(0.26, h + 0.02))
    shown.forEach((m, j) => coq(s, pptx, coqs, rep.history.find(hh => hh.match.id === m.id)?.analysis?.color ?? null, col.games + j * step + step / 2, y + h / 2, Math.min(0.18, step - 0.03, h)))
  })
  if (absent.length) s.addText(`Sans GPS sur le bloc : ${absent.map(x => `${x.player.last_name} ${x.player.first_name}`).join(', ')}`,
    { x: px + 0.2, y: py + ph - 0.3, w: pw - 0.4, h: 0.22, fontFace: FONT, fontSize: 8, color: C.muted, margin: 0, fit: 'shrink' })

  // Colonne de droite : couleur du bloc (anneau + coqs), groupes de poste
  const rx = 9.75, rw = 2.98
  panel(s, pptx, rx, py, rw, 2.25)
  heading(s, rx + 0.18, py + 0.12, rw - 0.3, 'Couleur du bloc', 'Attendus remplis en moyenne par match')
  colorRing(s, pptx, coqs, rx + 0.1, py + 0.62, rw - 0.15, r.blockColors, String(rows.filter(x => x.report.analysed).length), 'analysés')
  panel(s, pptx, rx, py + 2.4, rw, ph - 2.4)
  heading(s, rx + 0.18, py + 2.52, rw - 0.3, 'Par groupe de poste')
  s.addText('attendus · distance', { x: rx + 1.45, y: py + 2.56, w: rw - 1.6, h: 0.2, fontFace: FONT, fontSize: 7, color: C.muted, align: 'right', margin: 0 })
  // espacement ajusté au nombre de groupes : la liste tient toujours dans son bloc
  const gStep = Math.min(0.22, (ph - 2.95) / Math.max(1, r.groups.length)), gFont = gStep < 0.16 ? 7 : 8
  r.groups.forEach((g, i) => {
    const y = py + 2.85 + i * gStep
    s.addText(g.group.toLowerCase(), { x: rx + 0.18, y, w: 1.3, h: gStep, fontFace: FONT, fontSize: gFont, bold: true, color: C.ink, margin: 0, valign: 'middle', fit: 'shrink' })
    s.addText(`${n(g.filled)}/3 · ${n(g.distance)} %`, { x: rx + 1.45, y, w: rw - 1.6, h: gStep, fontFace: FONT, fontSize: gFont, color: C.soft, align: 'right', margin: 0, valign: 'middle' })
  })
  if (!r.groups.length) s.addText('Aucun joueur analysé.', { x: rx + 0.18, y: py + 3.02, w: rw - 0.3, h: 0.22, fontFace: FONT, fontSize: 9, color: C.muted, margin: 0 })

  await pptx.writeFile({ fileName })
}

// Photo ronde du joueur, sinon ses initiales. photo : image CARRÉE en données (« image/png;base64,… »), lue dans le
// stockage privé du staff au moment de l'export (photos de mineurs : jamais dans public/). Anneau à la couleur du niveau.
function avatar(s: Slide, pptx: Pptx, x: number, y: number, size: number, first: string, last: string, ring: string, photo?: string | null) {
  if (photo) s.addImage({ data: photo, x, y, w: size, h: size, rounding: true })
  else {
    s.addShape(pptx.ShapeType.ellipse, { x, y, w: size, h: size, fill: { color: C.bg }, line: { color: C.bg } })
    s.addText(`${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase(), { x, y, w: size, h: size, align: 'center', valign: 'middle', fontFace: DISPLAY, fontSize: 38, bold: true, color: C.ink, margin: 0 })
  }
  s.addShape(pptx.ShapeType.ellipse, { x, y, w: size, h: size, fill: { type: 'none' }, line: { color: ring, width: 3 } })
}

// Jauge « % de l'attendu » : piste jusqu'à 150 %, repère à 100 % (attendu atteint)
function gauge(s: Slide, pptx: Pptx, x: number, y: number, w: number, label: string, value: number | null, raw: string) {
  s.addText([
    { text: label, options: { color: C.soft } },
    { text: `   ${raw}`, options: { color: C.muted, fontSize: 9 } },
  ], { x, y, w: w - 1.3, h: 0.28, fontFace: FONT, fontSize: 11, margin: 0, valign: 'bottom' })
  s.addText(value === null ? '—' : `${value} %`, { x: x + w - 1.3, y: y - 0.1, w: 1.3, h: 0.4, align: 'right', fontFace: DISPLAY, fontSize: 22, bold: true,
    color: value === null ? C.muted : value >= 100 ? C.green : C.gold, margin: 0, valign: 'bottom' })
  const ty = y + 0.36, th = 0.16
  s.addShape(pptx.ShapeType.roundRect, { x, y: ty, w, h: th, fill: { color: C.bg }, line: { color: C.bg }, rectRadius: 0.08 })
  if (value !== null && value > 0) s.addShape(pptx.ShapeType.roundRect, { x, y: ty, w: Math.max(0.16, (w * Math.min(value, 150)) / 150), h: th,
    fill: { color: value >= 100 ? C.green : C.gold }, line: { color: value >= 100 ? C.green : C.gold }, rectRadius: 0.08 })
  const at100 = x + (w * 100) / 150
  s.addShape(pptx.ShapeType.rect, { x: at100 - 0.012, y: ty - 0.07, w: 0.024, h: th + 0.14, fill: { color: C.ink }, line: { color: C.ink } })
}

export async function downloadPlayerReport(r: ReturnType<typeof playerReport>, player: { first_name: string; last_name: string; position?: string | null }, period: string, fileName: string, photo?: string | null) {
  const d = await deck()
  const { pptx } = d
  const coqs = await loadCoqs()
  const single = r.history.length === 1
  const rec = single ? r.history[0].record : null
  const s = slide(d, single ? `Rendu individuel — ${r.history[0].match.opponent}` : 'Bilan individuel — bloc de matchs',
    single ? `${matchName(r.history[0].match)} · % de l'attendu au poste, ramené à 70 min` : `${period} · moyennes des matchs avec GPS, ramenées à 70 min`)
  const lastRec = [...r.history].reverse().find(h => h.record)

  // Carte de profil : photo (ou initiales), nom, poste, coq de niveau, chiffres clés, axe de travail
  const cx = 0.6, cw = 3.3, cy = 1.6, ch = 5.25
  panel(s, pptx, cx, cy, cw, ch)
  avatar(s, pptx, cx + (cw - 1.45) / 2, cy + 0.2, 1.45, player.first_name, player.last_name, r.color ? COLOR_HEX[r.color] : C.line, photo)
  s.addText(`${player.first_name} ${player.last_name}`, { x: cx + 0.15, y: cy + 1.75, w: cw - 0.3, h: 0.45, align: 'center', fontFace: DISPLAY, fontSize: 22, bold: true, color: C.ink, margin: 0, fit: 'shrink' })
  // poste du dernier GPS, sinon celui du profil (joueur sans match analysé)
  s.addText(lastRec ? lastRec.record!.position : player.position || 'Poste non renseigné', { x: cx + 0.15, y: cy + 2.18, w: cw - 0.3, h: 0.26, align: 'center', fontFace: FONT, fontSize: 10, color: C.muted, margin: 0 })
  if (r.color) {
    s.addShape(pptx.ShapeType.roundRect, { x: cx + 0.35, y: cy + 2.55, w: cw - 0.7, h: 0.5, fill: { color: C.bg }, line: { color: COLOR_HEX[r.color], width: 1.5 }, rectRadius: 0.25 })
    coq(s, pptx, coqs, r.color, cx + 0.68, cy + 2.8, 0.34)
    s.addText(COLOR_LABEL[r.color], { x: cx + 0.9, y: cy + 2.55, w: cw - 1.3, h: 0.5, valign: 'middle', fontFace: FONT, fontSize: 11, bold: true, color: COLOR_HEX[r.color], margin: 0, fit: 'shrink' })
  }
  const facts: [string, string][] = [
    [single ? n(r.minutes) : `${r.played}/${r.history.length}`, single ? 'min jouées' : 'matchs avec GPS'],
    [r.possible ? `${r.filled}/${r.possible}` : '—', 'attendus remplis'],
    [r.vmaxMax ? n(r.vmaxMax) : '—', `km/h Vmax${r.history.some(h => h.vmax?.record) ? ' ★' : ''}`],
  ]
  facts.forEach(([v, l], i) => {
    const fx = cx + 0.12 + i * ((cw - 0.24) / 3), fw = (cw - 0.24) / 3
    s.addText(v, { x: fx, y: cy + 3.3, w: fw, h: 0.45, align: 'center', fontFace: DISPLAY, fontSize: 22, bold: true, color: C.ink, margin: 0, fit: 'shrink' })
    s.addText(l, { x: fx, y: cy + 3.74, w: fw, h: 0.36, align: 'center', fontFace: FONT, fontSize: 8, color: C.muted, margin: 0, valign: 'top' })
  })
  s.addShape(pptx.ShapeType.rect, { x: cx + 0.25, y: cy + 4.3, w: cw - 0.5, h: 0.01, fill: { color: C.line }, line: { color: C.line } })
  s.addText([
    { text: 'Axe de travail', options: { color: C.muted, fontSize: 9, breakLine: true } },
    { text: r.axis ?? '—', options: { color: C.gold, bold: true, fontSize: 12 } },
  ], { x: cx + 0.15, y: cy + 4.4, w: cw - 0.3, h: 0.7, align: 'center', fontFace: FONT, margin: 0, valign: 'middle' })

  // Chiffres bruts (match) ou moyennes (bloc), en cartes
  const gx = 4.1, gw = 8.63
  tiles(s, pptx, gx, cy, gw, single ? [
    ['Temps de jeu', n(rec?.minutes ?? null), 'min'],
    ['Distance', n(rec?.distance_m ?? null), 'm'],
    ['Haute intensité', n(rec?.hi_distance_m ?? null), 'm'],
    ['Accélérations', n(rec?.accelerations ?? null), ''],
    ['Vmax', n(rec?.vmax ?? null), 'km/h', r.history[0].vmax?.record ? '★ record personnel' : undefined, C.gold],
  ] : [
    ['Temps de jeu', n(r.minutes), 'min', 'moyenne par match'],
    ['Distance', n(r.distance), 'm', 'moyenne par match'],
    ['Haute intensité', n(r.hi), 'm', 'moyenne par match'],
    ['Accélérations', n(r.accelerations), '', 'moyenne par match'],
    ['Vmax', n(r.vmaxMax), 'km/h', r.history.some(h => h.vmax?.record) ? '★ record personnel' : 'meilleure du bloc', C.gold],
  ])

  // Jauges des trois attendus
  const jy = cy + 1.13, jh = 2.3
  panel(s, pptx, gx, jy, gw, jh)
  heading(s, gx + 0.2, jy + 0.1, gw - 0.4, 'Face aux attendus du poste', 'Repère blanc : 100 % = attendu atteint (vert) ; en dessous : or')
  if (!r.analysed) s.addText('Aucun match analysé (GPS absent ou moins de 20 minutes jouées).', { x: gx + 0.2, y: jy + 0.9, w: gw - 0.4, h: 0.4, fontFace: FONT, fontSize: 12, color: C.muted, align: 'center', margin: 0 })
  else AXES.forEach(([k, label], i) => gauge(s, pptx, gx + 0.2, jy + 0.62 + i * 0.5, gw - 0.4, label, r.pcts[k],
    k === 'distance' ? n(r.distance, ' m') : k === 'hi' ? n(r.hi, ' m') : n(r.accelerations)))

  // Bas : bloc → évolution + coq GPS de chaque match ; match → coq du match en grand avec la lecture
  const by = jy + jh + 0.15, bh = cy + ch - by
  const analysed = r.history.filter(h => h.analysis)
  if (!single) {
    const lw = gw - 3.15
    panel(s, pptx, gx, by, lw, bh)
    heading(s, gx + 0.2, by + 0.1, lw - 0.4, 'Match par match', '% de l\'attendu à chaque match analysé')
    if (analysed.length >= 2) s.addChart(pptx.ChartType.line, AXES.map(([k, label]) => ({ name: label, labels: analysed.map(h => h.match.label ?? h.match.opponent), values: analysed.map(h => h.analysis!.pct[k]) })),
      // couleurs neutres : rouge et vert sont réservés à l'échelle de niveau
      { ...chart, x: gx + 0.1, y: by + 0.6, w: lw - 0.2, h: bh - 0.68, chartColors: [C.ink, C.gold, C.grey], lineSize: 2, lineDataSymbolSize: 5,
        plotArea: { fill: { color: C.surface } }, chartArea: { fill: { color: C.surface } },
        catAxisLabelFontSize: 8, valAxisLabelFontSize: 7, showLegend: true, legendPos: 'r', legendFontSize: 7 })
    else s.addText('Il faut au moins deux matchs analysés.', { x: gx + 0.2, y: by + 0.7, w: lw - 0.4, h: 0.3, fontFace: FONT, fontSize: 10, color: C.muted, margin: 0 })
    const rx = gx + lw + 0.15, rw = 3.0
    panel(s, pptx, rx, by, rw, bh)
    heading(s, rx + 0.18, by + 0.1, rw - 0.3, 'Couleur GPS par match', 'Les 6 derniers matchs du bloc')
    r.history.slice(-6).forEach((hh, i) => {
      const y = by + 0.55 + i * Math.min(0.24, (bh - 0.65) / 6)
      coq(s, pptx, coqs, hh.analysis?.color ?? null, rx + 0.32, y + 0.11, 0.2)
      s.addText(`${hh.match.label ? `${hh.match.label} · ` : ''}${hh.match.opponent}`, { x: rx + 0.5, y, w: rw - 1.15, h: 0.22, fontFace: FONT, fontSize: 9, color: C.soft, margin: 0, valign: 'middle', fit: 'shrink' })
      s.addText(hh.analysis ? `${hh.analysis.filled}/3` : hh.record ? '< 20 min' : '—', { x: rx + rw - 0.65, y, w: 0.5, h: 0.22, fontFace: FONT, fontSize: 8, color: C.muted, align: 'right', margin: 0, valign: 'middle' })
    })
  } else {
    panel(s, pptx, gx, by, gw, bh)
    const a = r.history[0].analysis
    if (a) {
      coq(s, pptx, coqs, a.color, gx + 0.65, by + bh / 2, 0.75)
      const reached = AXES.filter(([k]) => a.pct[k] >= 100).map(([, l]) => l.split(' (')[0].toLowerCase())
      const missed = AXES.filter(([k]) => a.pct[k] < 100).map(([k, l]) => `${l.split(' (')[0].toLowerCase()} ${a.pct[k]} %`)
      s.addText([
        { text: `${COLOR_LABEL[a.color]} · ${a.filled}/3 attendus`, options: { fontFace: DISPLAY, fontSize: 18, bold: true, color: COLOR_HEX[a.color], breakLine: true } },
        { text: reached.length ? `Atteints : ${reached.join(', ')}. ` : 'Aucun attendu atteint. ', options: { color: C.soft, fontSize: 11 } },
        { text: missed.length ? `À travailler : ${missed.join(', ')}.` : 'Les trois attendus du poste sont atteints.', options: { color: C.muted, fontSize: 11 } },
      ], { x: gx + 1.3, y: by + 0.1, w: gw - 1.5, h: bh - 0.2, fontFace: FONT, margin: 0, valign: 'middle' })
    } else s.addText(rec ? 'Moins de 20 minutes jouées : pas de % ni de couleur GPS sur ce match.' : 'Pas de GPS sur ce match.',
      { x: gx + 0.2, y: by, w: gw - 0.4, h: bh, fontFace: FONT, fontSize: 12, color: C.muted, align: 'center', valign: 'middle', margin: 0 })
  }

  await pptx.writeFile({ fileName })
}

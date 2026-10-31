// PowerPoint Performance (étape 11g) : une diapo par rendu, lisible d'un coup d'œil.
// - Rendu collectif d'un match : carte de chaleur des attendus GPS de tout l'effectif + répartition des couleurs.
// - Rendu collectif d'un bloc de matchs : moyennes de chaque joueur, couleur du bloc, régularité match par match.
// - Rendu individuel (un match, un bloc de matchs ou un cycle) : profil du joueur, jauges des attendus, évolution, regards croisés.
// Même charte et mêmes briques que les extractions de charge (staff/exportPptx.ts) ; créés dans le navigateur.
import type PptxGenJS from 'pptxgenjs'
import { formatDay } from '../../lib/week'
import { C, DISPLAY, FONT, chart, deck, empty, pct, slide } from '../staff/exportPptx'
import { COLOR_LABEL, GPS_COLORS, type RatingColor } from './gps'
import type { matchReport, playerReport, teamBlockReport } from './report'

const COLOR_HEX: Record<RatingColor, string> = { rouge: C.red, jaune: C.gold, vert: C.green, bleu: '3B82F6', gris: C.grey } // gris : n'a pas joué
const INK_ON: Record<RatingColor, string> = { rouge: C.ink, jaune: '1A1A1A', vert: '1A1A1A', bleu: C.ink, gris: C.ink }
const n = (v: number | null, unit = '') => (v === null ? '—' : `${v.toLocaleString('fr-FR')}${unit}`)
const matchName = (m: { opponent: string; label: string | null; match_date: string }) => `${m.label ? `${m.label} · ` : ''}${m.opponent} · ${formatDay(m.match_date)}`
const AXES = [['distance', 'Distance totale'], ['hi', 'Haute intensité (> 21 km/h)'], ['accelerations', 'Accélérations']] as const

type Slide = PptxGenJS.Slide
type Pptx = PptxGenJS

// Pastille de couleur (GPS ou note) ; vide si pas de couleur
function dot(s: Slide, pptx: Pptx, x: number, y: number, c: RatingColor | null, size = 0.17) {
  s.addShape(pptx.ShapeType.ellipse, { x: x - size / 2, y: y - size / 2, w: size, h: size,
    fill: { color: c ? COLOR_HEX[c] : C.bg }, line: { color: c ? COLOR_HEX[c] : C.line, width: 1 } })
}

// Légende de l'échelle de couleurs, commune aux deux rendus
function scaleLegend(s: Slide, pptx: Pptx, x: number, y: number, step = 3.05) {
  GPS_COLORS.forEach((c, i) => {
    dot(s, pptx, x + 0.09 + i * step, y + 0.12, c, 0.15)
    s.addText(`${i}/3 · ${COLOR_LABEL[c]}`, { x: x + 0.22 + i * step, y, w: step - 0.25, h: 0.25, fontFace: FONT, fontSize: 9, color: C.muted, margin: 0 })
  })
}

export async function downloadMatchReport(r: ReturnType<typeof matchReport>, match: { opponent: string; label: string | null; match_date: string }, fileName: string) {
  const d = await deck()
  const { pptx } = d
  const s = slide(d, `Rendu collectif — ${match.opponent}`,
    `${matchName(match)} · % de l'attendu au poste (ramené à 70 min) · case verte = attendu atteint`)

  // Carte de chaleur : une ligne par joueur avec GPS, du plus complet au moins complet (ordre du rapport)
  const rows = r.rows.filter(x => x.record)
  const missing = r.rows.filter(x => !x.record)
  const top = 1.9, bottom = 6.35
  const rowH = Math.min(0.3, (bottom - top - 0.3) / Math.max(1, rows.length))
  const font = rowH < 0.22 ? 8 : 10
  const col = { name: 0.6, pos: 2.85, min: 3.95, cells: 4.5, gps: 7.25, own: 8.05, staff: 8.75 }
  const cellW = 0.86
  const head = (t: string, x: number, w: number, align: 'left' | 'center' = 'center') =>
    s.addText(t, { x, y: top, w, h: 0.28, fontFace: FONT, fontSize: 9, color: C.muted, align, margin: 0, valign: 'bottom' })
  head('Joueur', col.name, 2.2, 'left'); head('Poste', col.pos, 1.05, 'left'); head('Min', col.min, 0.5)
  ;['Distance', 'Haute int.', 'Accél.'].forEach((t, i) => head(t, col.cells + i * (cellW + 0.05), cellW))
  head('GPS', col.gps, 0.7); head('Joueur', col.own, 0.6); head('Staff', col.staff, 0.6)
  if (!rows.length) empty(s, 'Aucun GPS importé pour ce match.')
  rows.forEach((x, i) => {
    const y = top + 0.32 + i * rowH, mid = y + rowH / 2
    if (i % 2) s.addShape(pptx.ShapeType.rect, { x: 0.6, y, w: 8.75, h: rowH, fill: { color: C.surface }, line: { color: C.surface } })
    const text = (t: string, x: number, w: number, o: Partial<PptxGenJS.TextPropsOptions> = {}) =>
      s.addText(t, { x, y, w, h: rowH, fontFace: FONT, fontSize: font, color: C.soft, margin: 0, valign: 'middle', ...o })
    // ★ : record de Vmax battu sur ce match, accroché au nom (pas de colonne en plus)
    text(`${x.player.last_name} ${x.player.first_name}${x.record_vmax ? ' ★' : ''}`, col.name + 0.05, 2.2, { color: C.ink, bold: true })
    text(x.record!.position.toLowerCase(), col.pos, 1.05)
    text(String(x.record!.minutes), col.min, 0.5, { align: 'center' })
    AXES.forEach(([k], j) => {
      const v = x.analysis?.pct[k] ?? null
      const ok = v !== null && v >= 100
      s.addShape(pptx.ShapeType.rect, { x: col.cells + j * (cellW + 0.05), y: y + 0.03, w: cellW, h: rowH - 0.06,
        fill: { color: ok ? C.green : C.bg }, line: { color: ok ? C.green : C.line, width: 0.5 } })
      text(v === null ? (j === 1 ? '< 20 min' : '') : `${v} %`, col.cells + j * (cellW + 0.05), cellW,
        { align: 'center', color: ok ? '1A1A1A' : C.soft, bold: ok })
    })
    if (x.analysis) dot(s, pptx, col.gps + 0.35, mid, x.analysis.color)
    else text('—', col.gps, 0.7, { align: 'center', color: C.muted })
    dot(s, pptx, col.own + 0.3, mid, x.own); dot(s, pptx, col.staff + 0.3, mid, x.staff)
  })
  if (missing.length) s.addText(`Sans GPS : ${missing.map(x => `${x.player.last_name} ${x.player.first_name}`).join(', ')}`,
    { x: 0.6, y: 6.38, w: 8.75, h: 0.28, fontFace: FONT, fontSize: 9, color: C.muted, margin: 0 })

  // Colonne de droite : répartition des couleurs GPS, groupes de poste, regards croisés
  const px = 9.75, pw = 2.98
  s.addShape(pptx.ShapeType.roundRect, { x: px - 0.15, y: 1.85, w: pw + 0.3, h: 4.75, fill: { color: C.surface }, line: { color: C.surface }, rectRadius: 0.12 })
  s.addText([
    { text: String(r.withGps), options: { fontFace: DISPLAY, fontSize: 30, bold: true, color: C.ink } },
    { text: `  joueurs avec GPS sur ${r.rows.length}`, options: { fontSize: 11, color: C.muted } },
  ], { x: px, y: 1.95, w: pw, h: 0.55, fontFace: FONT, margin: 0, valign: 'middle' })
  const colors = GPS_COLORS.filter(c => r.gpsColors[c] > 0)
  if (colors.length) s.addChart(pptx.ChartType.doughnut, [{ name: 'Couleur GPS', labels: colors.map(c => COLOR_LABEL[c]), values: colors.map(c => r.gpsColors[c]) }],
    { ...chart, x: px, y: 2.5, w: 1.6, h: 1.6, holeSize: 55, chartColors: colors.map(c => COLOR_HEX[c]), dataBorder: { pt: 1.5, color: C.surface },
      plotArea: { fill: { color: C.surface } }, chartArea: { fill: { color: C.surface } }, showLegend: false, showValue: true, showPercent: false,
      dataLabelColor: '1A1A1A', dataLabelFontSize: 10, dataLabelFontBold: true })
  s.addText(GPS_COLORS.map(c => ({ text: `${r.gpsColors[c]}  ${COLOR_LABEL[c]}`, options: { color: r.gpsColors[c] ? COLOR_HEX[c] : C.muted, bold: r.gpsColors[c] > 0, breakLine: true } })),
    { x: px + 1.65, y: 2.55, w: pw - 1.65, h: 1.5, fontFace: FONT, fontSize: 9, margin: 0, valign: 'middle', paraSpaceAfter: 3 })
  s.addText([
    { text: 'Par groupe de poste', options: { bold: true, color: C.gold, fontSize: 12, breakLine: true } },
    ...(r.groups.length ? r.groups : []).map(g => ({ text: `${g.group} · ${n(g.filled)}/3 attendus · dist. ${pct(g.distance)}`, options: { color: C.soft, fontSize: 9, breakLine: true } })),
    ...(r.groups.length ? [] : [{ text: 'Aucun joueur analysé.', options: { color: C.muted, fontSize: 10, breakLine: true } }]),
    { text: ' ', options: { fontSize: 6, breakLine: true } },
    { text: 'Regards croisés', options: { bold: true, color: C.gold, fontSize: 12, breakLine: true } },
    { text: r.bothRated ? `Joueur et staff d'accord sur ${r.agreement} joueur${r.agreement > 1 ? 's' : ''} sur ${r.bothRated}.` : 'Pas encore de match noté à la fois par le joueur et le staff.', options: { color: C.soft, fontSize: 10 } },
  ], { x: px, y: 4.2, w: pw, h: 2.35, fontFace: FONT, margin: 0, valign: 'top', paraSpaceAfter: 2 })
  if (r.rows.some(x => x.record_vmax)) s.addText('★ record de Vmax battu', { x: 6.9, y: 6.38, w: 2.45, h: 0.28, align: 'right', fontFace: FONT, fontSize: 9, color: C.gold, margin: 0 })
  scaleLegend(s, pptx, 0.6, 6.68, 2.2) // sous le tableau seulement : la colonne de droite descend jusqu'au pied

  await pptx.writeFile({ fileName })
}

// Rendu collectif d'un bloc de matchs : moyennes de chaque joueur sur le bloc (carte de chaleur), couleur du bloc,
// régularité match par match (une pastille GPS par match), répartition des couleurs et groupes de poste à droite
export async function downloadTeamBlockReport(r: ReturnType<typeof teamBlockReport>, fileName: string) {
  const d = await deck()
  const { pptx } = d
  const first = r.matches[0], last = r.matches.at(-1)
  const s = slide(d, 'Rendu collectif — bloc de matchs',
    first && last ? `${r.matches.length} match${r.matches.length > 1 ? 's' : ''} · ${formatDay(first.match_date)} → ${formatDay(last.match_date)} · moyennes du bloc, % de l'attendu au poste · case verte = attendu atteint` : 'Aucun match dans le bloc')

  const rows = r.players.filter(x => x.report.played > 0)
  const shown = r.matches.slice(-6) // au-delà de 6 matchs, les 6 derniers : la régularité se lit encore
  const top = 1.9, bottom = 6.35
  const rowH = Math.min(0.3, (bottom - top - 0.3) / Math.max(1, rows.length))
  const font = rowH < 0.22 ? 8 : 10
  const col = { name: 0.6, grp: 2.85, nb: 4.0, cells: 4.55, bloc: 7.35, games: 8.05 }
  const cellW = 0.86, step = Math.min(0.22, 1.3 / Math.max(1, shown.length))
  const head = (t: string, x: number, w: number, align: 'left' | 'center' = 'center', size = 9) =>
    s.addText(t, { x, y: top, w, h: 0.28, fontFace: FONT, fontSize: size, color: C.muted, align, margin: 0, valign: 'bottom' })
  head('Joueur', col.name, 2.2, 'left'); head('Groupe', col.grp, 1.1, 'left'); head('Matchs', col.nb, 0.55)
  ;['Distance', 'Haute int.', 'Accél.'].forEach((t, i) => head(t, col.cells + i * (cellW + 0.05), cellW))
  head('Bloc', col.bloc, 0.6)
  shown.forEach((m, i) => head(m.label ?? m.opponent.slice(0, 3), col.games + i * step, step, 'center', 7))
  if (!rows.length) empty(s, 'Aucun GPS importé sur ce bloc de matchs.')
  rows.forEach((x, i) => {
    const y = top + 0.32 + i * rowH, mid = y + rowH / 2, rep = x.report
    if (i % 2) s.addShape(pptx.ShapeType.rect, { x: 0.6, y, w: 8.75, h: rowH, fill: { color: C.surface }, line: { color: C.surface } })
    const text = (t: string, tx: number, w: number, o: Partial<PptxGenJS.TextPropsOptions> = {}) =>
      s.addText(t, { x: tx, y, w, h: rowH, fontFace: FONT, fontSize: font, color: C.soft, margin: 0, valign: 'middle', ...o })
    text(`${x.player.last_name} ${x.player.first_name}`, col.name + 0.05, 2.2, { color: C.ink, bold: true })
    text(x.group ?? '—', col.grp, 1.1)
    text(`${rep.played}/${rep.history.length}`, col.nb, 0.55, { align: 'center' })
    AXES.forEach(([k], j) => {
      const v = rep.pcts[k]
      const ok = v !== null && v >= 100
      s.addShape(pptx.ShapeType.rect, { x: col.cells + j * (cellW + 0.05), y: y + 0.03, w: cellW, h: rowH - 0.06,
        fill: { color: ok ? C.green : C.bg }, line: { color: ok ? C.green : C.line, width: 0.5 } })
      text(v === null ? (j === 1 ? '< 20 min' : '') : `${v} %`, col.cells + j * (cellW + 0.05), cellW, { align: 'center', color: ok ? '1A1A1A' : C.soft, bold: ok })
    })
    dot(s, pptx, col.bloc + 0.3, mid, rep.color, 0.19)
    shown.forEach((m, j) => dot(s, pptx, col.games + j * step + step / 2, mid, rep.history.find(h => h.match.id === m.id)?.analysis?.color ?? null, Math.min(0.15, step - 0.05)))
  })
  const absent = r.players.filter(x => x.report.played === 0)
  if (absent.length) s.addText(`Sans GPS sur le bloc : ${absent.map(x => `${x.player.last_name} ${x.player.first_name}`).join(', ')}`,
    { x: 0.6, y: 6.38, w: 8.75, h: 0.28, fontFace: FONT, fontSize: 9, color: C.muted, margin: 0, fit: 'shrink' })

  // Colonne de droite : couleurs de bloc, attendus remplis, groupes de poste, matchs du bloc
  const px = 9.75, pw = 2.98
  s.addShape(pptx.ShapeType.roundRect, { x: px - 0.15, y: 1.85, w: pw + 0.3, h: 4.75, fill: { color: C.surface }, line: { color: C.surface }, rectRadius: 0.12 })
  s.addText([
    { text: r.possible ? `${r.filled}/${r.possible}` : '—', options: { fontFace: DISPLAY, fontSize: 28, bold: true, color: C.ink } },
    { text: '  attendus remplis sur le bloc', options: { fontSize: 10, color: C.muted } }, // joueurs sans GPS : listés sous le tableau
  ], { x: px, y: 1.95, w: pw, h: 0.55, fontFace: FONT, margin: 0, valign: 'middle' })
  const colors = GPS_COLORS.filter(c => r.blockColors[c] > 0)
  if (colors.length) s.addChart(pptx.ChartType.doughnut, [{ name: 'Couleur du bloc', labels: colors.map(c => COLOR_LABEL[c]), values: colors.map(c => r.blockColors[c]) }],
    { ...chart, x: px, y: 2.5, w: 1.6, h: 1.6, holeSize: 55, chartColors: colors.map(c => COLOR_HEX[c]), dataBorder: { pt: 1.5, color: C.surface },
      plotArea: { fill: { color: C.surface } }, chartArea: { fill: { color: C.surface } }, showLegend: false, showValue: true, showPercent: false,
      dataLabelColor: '1A1A1A', dataLabelFontSize: 10, dataLabelFontBold: true })
  s.addText(GPS_COLORS.map(c => ({ text: `${r.blockColors[c]}  ${COLOR_LABEL[c]}`, options: { color: r.blockColors[c] ? COLOR_HEX[c] : C.muted, bold: r.blockColors[c] > 0, breakLine: true } })),
    { x: px + 1.65, y: 2.55, w: pw - 1.65, h: 1.5, fontFace: FONT, fontSize: 9, margin: 0, valign: 'middle', paraSpaceAfter: 3 })
  s.addText([
    { text: 'Par groupe de poste', options: { bold: true, color: C.gold, fontSize: 12, breakLine: true } },
    ...(r.groups.length ? r.groups.map(g => ({ text: `${g.group} · ${n(g.filled)}/3 attendus · dist. ${pct(g.distance)}`, options: { color: C.soft, fontSize: 9, breakLine: true } }))
      : [{ text: 'Aucun joueur analysé.', options: { color: C.muted, fontSize: 9, breakLine: true } }]),
    { text: ' ', options: { fontSize: 6, breakLine: true } },
    { text: 'Matchs du bloc', options: { bold: true, color: C.gold, fontSize: 12, breakLine: true } },
    { text: r.matches.map(m => `${m.label ? `${m.label} ` : ''}${m.opponent}`).join(' · ') || '—', options: { color: C.soft, fontSize: 9 } },
  ], { x: px, y: 4.2, w: pw, h: 2.35, fontFace: FONT, margin: 0, valign: 'top', paraSpaceAfter: 2 })
  scaleLegend(s, pptx, 0.6, 6.68, 2.2)

  await pptx.writeFile({ fileName })
}

// Photo ronde du joueur, sinon ses initiales. photo : image CARRÉE en données (« image/png;base64,… »), lue dans le
// stockage privé du staff au moment de l'export (photos de mineurs : jamais dans public/). Anneau à la couleur du niveau.
function avatar(s: Slide, pptx: Pptx, x: number, y: number, size: number, first: string, last: string, ring: string, photo?: string | null) {
  if (photo) s.addImage({ data: photo, x, y, w: size, h: size, rounding: true })
  else {
    s.addShape(pptx.ShapeType.ellipse, { x, y, w: size, h: size, fill: { color: C.bg }, line: { color: C.bg } })
    s.addText(`${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase(), { x, y, w: size, h: size, align: 'center', valign: 'middle', fontFace: DISPLAY, fontSize: 40, bold: true, color: C.ink, margin: 0 })
  }
  s.addShape(pptx.ShapeType.ellipse, { x, y, w: size, h: size, fill: { type: 'none' }, line: { color: ring, width: 3 } })
}

// Jauge « % de l'attendu » : piste jusqu'à 150 %, repère à 100 % (attendu atteint)
function gauge(s: Slide, pptx: Pptx, x: number, y: number, w: number, label: string, value: number | null, raw: string) {
  s.addText(label, { x, y, w: w - 1.6, h: 0.3, fontFace: FONT, fontSize: 12, color: C.soft, margin: 0, valign: 'bottom' })
  s.addText(value === null ? '—' : `${value} %`, { x: x + w - 1.6, y: y - 0.12, w: 1.6, h: 0.45, align: 'right', fontFace: DISPLAY, fontSize: 24, bold: true,
    color: value === null ? C.muted : value >= 100 ? C.green : C.gold, margin: 0, valign: 'bottom' })
  const ty = y + 0.4, th = 0.2
  s.addShape(pptx.ShapeType.roundRect, { x, y: ty, w, h: th, fill: { color: C.surface }, line: { color: C.surface }, rectRadius: 0.1 })
  if (value !== null && value > 0) s.addShape(pptx.ShapeType.roundRect, { x, y: ty, w: Math.max(0.2, (w * Math.min(value, 150)) / 150), h: th,
    fill: { color: value >= 100 ? C.green : C.gold }, line: { color: value >= 100 ? C.green : C.gold }, rectRadius: 0.1 })
  const at100 = x + (w * 100) / 150
  s.addShape(pptx.ShapeType.rect, { x: at100 - 0.015, y: ty - 0.08, w: 0.03, h: th + 0.16, fill: { color: C.ink }, line: { color: C.ink } })
  s.addText(raw, { x, y: ty + 0.22, w, h: 0.25, fontFace: FONT, fontSize: 9, color: C.muted, margin: 0 })
}

export async function downloadPlayerReport(r: ReturnType<typeof playerReport>, player: { first_name: string; last_name: string; position?: string | null }, period: string, fileName: string, photo?: string | null) {
  const d = await deck()
  const { pptx } = d
  const single = r.history.length === 1
  const s = slide(d, single ? `Rendu individuel — ${r.history[0].match.opponent}` : 'Bilan individuel — bloc de matchs',
    single ? matchName(r.history[0].match) : `${period} · moyennes des matchs avec GPS, ramenées à 70 min`)
  const last = [...r.history].reverse().find(h => h.record)

  // Carte de profil : photo (initiales pour l'instant), nom, poste, couleur, chiffres clés
  const cx = 0.6, cw = 3.4
  s.addShape(pptx.ShapeType.roundRect, { x: cx, y: 1.85, w: cw, h: 4.7, fill: { color: C.surface }, line: { color: C.surface }, rectRadius: 0.15 })
  avatar(s, pptx, cx + (cw - 1.5) / 2, 2.05, 1.5, player.first_name, player.last_name, r.color ? COLOR_HEX[r.color] : C.line, photo)
  s.addText(`${player.first_name} ${player.last_name}`, { x: cx + 0.15, y: 3.65, w: cw - 0.3, h: 0.5, align: 'center', fontFace: DISPLAY, fontSize: 22, bold: true, color: C.ink, margin: 0, fit: 'shrink' })
  // poste du dernier GPS, sinon celui du profil (joueur sans match analysé)
  s.addText(last ? last.record!.position : player.position || 'Poste non renseigné', { x: cx + 0.15, y: 4.12, w: cw - 0.3, h: 0.3, align: 'center', fontFace: FONT, fontSize: 11, color: C.muted, margin: 0 })
  if (r.color) {
    s.addShape(pptx.ShapeType.roundRect, { x: cx + 0.4, y: 4.5, w: cw - 0.8, h: 0.42, fill: { color: COLOR_HEX[r.color] }, line: { color: COLOR_HEX[r.color] }, rectRadius: 0.21 })
    s.addText(COLOR_LABEL[r.color], { x: cx + 0.4, y: 4.5, w: cw - 0.8, h: 0.42, align: 'center', valign: 'middle', fontFace: FONT, fontSize: 12, bold: true, color: INK_ON[r.color], margin: 0 })
  }
  const facts: [string, string][] = [
    [single ? n(r.minutes, ' min') : `${r.played}/${r.history.length}`, single ? 'jouées' : 'matchs avec GPS'],
    [r.possible ? `${r.filled}/${r.possible}` : '—', 'attendus remplis'],
    [r.vmaxMax ? `${n(r.vmaxMax)}` : '—', `km/h Vmax${r.history.some(h => h.vmax?.record) ? ' ★ record' : ''}`],
  ]
  facts.forEach(([v, l], i) => {
    const fx = cx + 0.15 + i * ((cw - 0.3) / 3), fw = (cw - 0.3) / 3
    s.addText(v, { x: fx, y: 5.1, w: fw, h: 0.5, align: 'center', fontFace: DISPLAY, fontSize: 22, bold: true, color: C.ink, margin: 0, fit: 'shrink' })
    s.addText(l, { x: fx, y: 5.58, w: fw, h: 0.45, align: 'center', fontFace: FONT, fontSize: 9, color: C.muted, margin: 0, valign: 'top' })
  })
  s.addText([
    { text: 'Axe de travail  ', options: { color: C.muted } },
    { text: r.axis ?? '—', options: { color: C.ink, bold: true } },
  ], { x: cx + 0.15, y: 6.02, w: cw - 0.3, h: 0.45, align: 'center', fontFace: FONT, fontSize: 11, margin: 0, valign: 'middle' })

  // Jauges des trois attendus (moyennes du bloc, ou valeurs du match)
  const gx = 4.4, gw = 8.33
  if (!r.analysed) empty(s, 'Aucun match analysé (GPS absent ou moins de 20 minutes jouées).')
  else AXES.forEach(([k, label], i) => gauge(s, pptx, gx, 1.9 + i * 0.85, gw, label, r.pcts[k],
    k === 'distance' ? `${n(r.distance, ' m')}${single ? '' : ' en moyenne'}` : k === 'hi' ? `${n(r.hi, ' m')}${single ? '' : ' en moyenne'}` : `${n(r.accelerations)}${single ? '' : ' en moyenne'}`))

  const analysed = r.history.filter(h => h.analysis)
  if (!single && analysed.length >= 2) {
    // Bloc : évolution des trois attendus match par match
    const labels = analysed.map(h => h.match.label ?? h.match.opponent)
    s.addText('Match par match (% de l\'attendu)', { x: gx, y: 4.45, w: 5.2, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.gold, margin: 0 })
    s.addChart(pptx.ChartType.line, AXES.map(([k, label]) => ({ name: label, labels, values: analysed.map(h => h.analysis!.pct[k]) })),
      // couleurs neutres : rouge et vert sont réservés à l'échelle de niveau
      { ...chart, x: gx - 0.1, y: 4.7, w: 5.4, h: 1.95, chartColors: [C.ink, C.gold, C.grey], lineSize: 2.5, lineDataSymbolSize: 6,
        catAxisLabelFontSize: 9, valAxisLabelFontSize: 8, showLegend: true, legendPos: 'b', legendFontSize: 8 })
  }

  // Regards croisés : couleur GPS, note du joueur, note du staff, match par match
  const rx = single ? gx : 9.95, rw = single ? gw : 2.78
  s.addText('Regards croisés', { x: rx, y: 4.45, w: rw, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.gold, margin: 0 })
  const heads = ['GPS', 'Joueur', 'Staff']
  heads.forEach((h, j) => s.addText(h, { x: rx + rw - 1.95 + j * 0.65, y: 4.78, w: 0.65, h: 0.25, align: 'center', fontFace: FONT, fontSize: 9, color: C.muted, margin: 0 }))
  r.history.slice(-6).forEach((h, i) => {
    const y = 5.05 + i * 0.3
    s.addText(single ? 'Ce match' : (h.match.label ?? h.match.opponent), { x: rx, y, w: rw - 2, h: 0.28, fontFace: FONT, fontSize: 10, color: C.soft, margin: 0, valign: 'middle', fit: 'shrink' })
    ;[h.analysis?.color ?? null, h.own, h.staff].forEach((c, j) => dot(s, pptx, rx + rw - 1.95 + j * 0.65 + 0.325, y + 0.14, c))
  })
  if (single) {
    // Match seul : les chiffres bruts en tuiles sous les regards croisés
    const rec = r.history[0].record
    const tiles: [string, string][] = rec ? [[n(rec.minutes), 'min jouées'], [n(rec.distance_m), 'm parcourus'], [n(rec.hi_distance_m), 'm à haute intensité'],
      [n(rec.accelerations), 'accélérations'], [rec.vmax ? n(rec.vmax) : '—', 'km/h Vmax']] : []
    tiles.forEach(([v, l], i) => {
      const tx = gx + i * (gw / 5)
      s.addText(v, { x: tx, y: 5.55, w: gw / 5 - 0.1, h: 0.55, fontFace: DISPLAY, fontSize: 26, bold: true, color: C.ink, margin: 0 })
      s.addText(l, { x: tx, y: 6.08, w: gw / 5 - 0.1, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted, margin: 0 })
    })
  }
  scaleLegend(s, pptx, 0.6, 6.68)

  await pptx.writeFile({ fileName })
}

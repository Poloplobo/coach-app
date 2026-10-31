// PowerPoint Performance (étape 11g) : rendu équipe d'un match, bilan individuel d'un bloc de matchs.
// Même charte et mêmes briques que les extractions de charge (staff/exportPptx.ts) ; créés dans le navigateur.
import { formatDay } from '../../lib/week'
import { C, DISPLAY, FONT, chart, coverSlide, deck, empty, kpis, pct, slide, table, tableStyle } from '../staff/exportPptx'
import { COLOR_LABEL, GPS_COLORS, type GpsColor } from './gps'
import type { matchReport, playerReport } from './report'

const COLOR_HEX: Record<GpsColor, string> = { rouge: C.red, jaune: C.gold, vert: C.green, bleu: '3B82F6' }
const colorText = (c: GpsColor | null) => (c ? c : '—')
const n = (v: number | null, unit = '') => (v === null ? '—' : `${v.toLocaleString('fr-FR')}${unit}`)
const matchName = (m: { opponent: string; label: string | null; match_date: string }) => `${m.label ? `${m.label} · ` : ''}${m.opponent} · ${formatDay(m.match_date)}`

// Répartition des couleurs (GPS, joueurs ou staff) : barres empilées, une série par couleur
function colorBars(counts: Record<string, Record<GpsColor, number>>) {
  const labels = Object.keys(counts)
  return GPS_COLORS.map(c => ({ name: COLOR_LABEL[c], labels, values: labels.map(l => counts[l][c]) }))
}

export async function downloadMatchReport(r: ReturnType<typeof matchReport>, match: { opponent: string; label: string | null; match_date: string }, fileName: string) {
  const d = await deck()
  const { pptx } = d

  // 1. Couverture : chiffres clés du match
  const cover = coverSlide(d, 'Rendu équipe — match', match.opponent, matchName(match))
  kpis(cover, d, [
    { value: String(r.withGps), label: `joueurs avec GPS (sur ${r.rows.length})` },
    { value: `${r.gpsColors.bleu + r.gpsColors.vert}`, label: 'en vert ou bleu au GPS (2 ou 3 attendus sur 3)', color: C.green },
    { value: `${r.rows.filter(x => x.own).length}/${r.rows.length}`, label: 'joueurs se sont notés' },
    { value: r.bothRated ? `${r.agreement}/${r.bothRated}` : '—', label: 'même couleur joueur et staff', color: C.gold },
  ])

  // 2. Tableau du match (calque du tableau de l'app)
  const t = slide(d, 'GPS et notes du match', '% de l\'attendu au poste du match, ramené à 70 min · couleur GPS = attendus remplis sur 3 · < 20 min : pas de couleur')
  t.addTable(table(['Joueur', 'Poste', 'Min', 'Distance', 'DHI', 'Accél.', 'Vmax', 'GPS', 'Note joueur', 'Note staff'],
    r.rows.map(x => [
      `${x.player.last_name} ${x.player.first_name}`, x.record ? x.record.position.toLowerCase() : 'pas de GPS', x.record ? x.record.minutes : '',
      x.analysis ? pct(x.analysis.pct.distance) : x.record ? n(x.record.distance_m, ' m') : '',
      x.analysis ? pct(x.analysis.pct.hi) : '', x.analysis ? pct(x.analysis.pct.accelerations) : '',
      x.record?.vmax ? `${n(x.record.vmax)}${x.record_vmax ? ' ★' : ''}` : '',
      x.analysis ? `${x.analysis.filled}/3 ${x.analysis.color}` : x.record ? '< 20 min' : '', colorText(x.own), colorText(x.staff),
    ])), { ...tableStyle, fontSize: r.rows.length > 14 ? 10 : 11, x: 0.6, y: 1.75, w: 12.13, autoPage: true,
    colW: [2.3, 1.5, 0.6, 1.2, 1.0, 1.0, 0.9, 1.3, 1.2, 1.13] })

  // 3. Par groupe de poste
  const g = slide(d, 'Attendus par groupe de poste', 'Moyenne des joueurs analysés : % de l\'attendu (100 % = attendu du poste atteint)')
  if (!r.groups.length) empty(g, 'Aucun joueur analysé (GPS absent ou moins de 20 minutes jouées).')
  else g.addChart(pptx.ChartType.bar, [
    { name: 'Distance totale', labels: r.groups.map(x => x.group), values: r.groups.map(x => x.distance) },
    { name: 'Haute intensité', labels: r.groups.map(x => x.group), values: r.groups.map(x => x.hi) },
    { name: 'Accélérations', labels: r.groups.map(x => x.group), values: r.groups.map(x => x.accelerations) },
  ], { ...chart, x: 0.6, y: 1.8, w: 12.13, h: 5.0, barGrouping: 'clustered', chartColors: [C.red, C.gold, C.green], showLegend: true, legendPos: 'b',
    showValue: true, dataLabelFontSize: 10, valAxisTitle: '% de l\'attendu', showValAxisTitle: true })

  // 4. Trois regards : GPS, joueurs, staff
  const v = slide(d, 'GPS, auto-évaluation et note du staff', 'Répartition des couleurs : rouge en dessous du niveau → bleu a dominé le niveau')
  v.addChart(pptx.ChartType.bar, colorBars({ 'Couleur GPS': r.gpsColors, 'Notes joueurs': r.ownColors, 'Notes staff': r.staffColors }),
    { ...chart, x: 0.6, y: 1.8, w: 12.13, h: 5.0, barDir: 'bar', barGrouping: 'stacked', chartColors: GPS_COLORS.map(c => COLOR_HEX[c]),
      showLegend: true, legendPos: 'b', showValue: true, dataLabelFontSize: 11 })

  await pptx.writeFile({ fileName })
}

export async function downloadPlayerReport(r: ReturnType<typeof playerReport>, player: { first_name: string; last_name: string }, period: string, fileName: string) {
  const d = await deck()
  const { pptx } = d

  // 1. Couverture : le bloc en chiffres (calque de « Bilan bloc »)
  const cover = coverSlide(d, 'Bilan GPS et matchs', `${player.first_name} ${player.last_name}`, period)
  kpis(cover, d, [
    { value: `${r.played}/${r.history.length}`, label: 'matchs avec GPS' },
    { value: r.possible ? `${r.filled}/${r.possible}` : '—', label: 'attendus remplis sur le bloc', color: r.color ? COLOR_HEX[r.color] : undefined },
    { value: r.vmaxMax ? `${n(r.vmaxMax)} km/h` : '—', label: 'Vmax max du bloc', color: C.gold },
    { value: r.axis ?? '—', label: 'axe de travail (attendu le moins atteint)', color: C.red },
  ])

  // 2. Historique match par match (calque de « Fiche joueur »)
  const h = slide(d, 'Match par match', 'Chiffres réalisés, % de l\'attendu au poste (ramené à 70 min), couleur GPS et notes')
  h.addTable(table(['Match', 'Min', 'Distance', 'DHI', 'Accél.', 'Vmax', 'GPS', 'Ma note', 'Staff'],
    r.history.map(x => [
      matchName(x.match), x.record ? x.record.minutes : 'pas de GPS',
      x.record ? `${n(x.record.distance_m, ' m')}${x.analysis ? ` · ${pct(x.analysis.pct.distance)}` : ''}` : '',
      x.record ? `${n(x.record.hi_distance_m, ' m')}${x.analysis ? ` · ${pct(x.analysis.pct.hi)}` : ''}` : '',
      x.record ? `${x.record.accelerations}${x.analysis ? ` · ${pct(x.analysis.pct.accelerations)}` : ''}` : '',
      x.record?.vmax ? `${n(x.record.vmax)}${x.vmax?.record ? ' ★ record' : ''}` : '',
      x.analysis ? `${x.analysis.filled}/3 ${x.analysis.color}` : x.record ? '< 20 min' : '', colorText(x.own), colorText(x.staff),
    ])), { ...tableStyle, fontSize: 11, x: 0.6, y: 1.75, w: 12.13, autoPage: true, colW: [2.9, 1.0, 1.6, 1.4, 1.2, 1.3, 1.1, 0.83, 0.8] })

  // 3. Courbes des % de l'attendu
  const analysed = r.history.filter(x => x.analysis)
  const p = slide(d, 'Évolution face aux attendus du poste', '% de l\'attendu à chaque match analysé ; 100 % = attendu atteint')
  if (analysed.length < 2) empty(p, 'Il faut au moins deux matchs analysés (GPS et 20 minutes jouées) pour une évolution.')
  else {
    const labels = analysed.map(x => x.match.label ?? x.match.opponent)
    p.addChart(pptx.ChartType.line, [
      { name: 'Distance totale', labels, values: analysed.map(x => x.analysis!.pct.distance) },
      { name: 'Haute intensité', labels, values: analysed.map(x => x.analysis!.pct.hi) },
      { name: 'Accélérations', labels, values: analysed.map(x => x.analysis!.pct.accelerations) },
    ], { ...chart, x: 0.6, y: 1.8, w: 12.13, h: 5.0, chartColors: [C.red, C.gold, C.green], lineSize: 3, lineDataSymbolSize: 8,
      showLegend: true, legendPos: 'b', valAxisTitle: '% de l\'attendu', showValAxisTitle: true })
  }

  // 4. Moyennes du bloc et regards croisés
  const s = slide(d, 'Le bloc en moyenne', `Moyennes sur ${r.played} match${r.played > 1 ? 's' : ''} avec GPS ; couleur du bloc = moyenne des attendus remplis`)
  s.addTable(table(['Indicateur', 'Moyenne par match', '% de l\'attendu'], [
    ['Temps de jeu', n(r.minutes, ' min'), ''],
    ['Distance totale', n(r.distance, ' m'), pct(r.pcts.distance)],
    ['Distance haute intensité (> 21 km/h)', n(r.hi, ' m'), pct(r.pcts.hi)],
    ['Accélérations', n(r.accelerations), pct(r.pcts.accelerations)],
    ['Attendus remplis', r.meanFilled === null ? '—' : `${n(r.meanFilled)} / 3`, r.color ?? '—'],
  ]), { ...tableStyle, fontSize: 13, x: 0.6, y: 1.8, w: 7.2, colW: [3.4, 2.0, 1.8] })
  const rated = r.history.filter(x => x.own && x.staff)
  s.addText([
    { text: 'Regards croisés', options: { bold: true, color: C.gold, fontSize: 16, breakLine: true } },
    { text: rated.length ? `Même couleur que le staff sur ${rated.filter(x => x.own === x.staff).length} match${rated.length > 1 ? 's' : ''} sur ${rated.length}.` : 'Pas encore de match noté à la fois par le joueur et le staff.', options: { color: C.soft, fontSize: 13, breakLine: true } },
    { text: ' ', options: { breakLine: true } },
    { text: 'Axe de travail', options: { bold: true, color: C.gold, fontSize: 16, breakLine: true } },
    { text: r.axis ? `${r.axis} : l'attendu le moins atteint en moyenne sur le bloc.` : '—', options: { color: C.soft, fontSize: 13 } },
  ], { x: 8.2, y: 1.8, w: 4.5, h: 4.8, valign: 'top', fontFace: FONT })
  void DISPLAY // même charte que les autres extractions (titres en Arial Narrow via slide/coverSlide)

  await pptx.writeFile({ fileName })
}

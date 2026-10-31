// Extractions PowerPoint (étape 9) : bilan de cycle d'un joueur, résumé collectif d'une semaine.
// Fichier créé dans le navigateur (pptxgenjs chargé au clic) : aucune donnée ne passe par un service tiers.
// Graphiques natifs, modifiables dans PowerPoint / Keynote / Google Slides.
// Charte du club : fond sombre, rouge RNR, or, logo Pôle Espoir en couverture, blason sur chaque diapo.
import type PptxGenJS from 'pptxgenjs'
import { BRAND } from '../../lib/brand'
import { formatDay, parisDate } from '../../lib/week'
import { DAY_NAMES, dailySynthesis, pillarSplit, rangeLabel, type ActivityType, type Log, type WeekType } from './load'
import { PILLAR_LABEL } from './exportWeek'
import type { cycleReport, weekReport } from './report'

const hex = (c: string) => c.replace('#', '')
// Fond sombre : textes clairs ; le rouge RNR seulement en grands chiffres gras (contraste insuffisant en petit texte)
export const C = {
  cover: '0E0E10', // fond exact du logo Pôle Espoir sombre
  bg: '1A1A1A', surface: '242424', line: '3A3A3A',
  ink: 'FFFFFF', soft: 'D4D4D8', muted: 'A1A1AA',
  red: hex(BRAND.rnr), gold: 'FFD700', green: hex(BRAND.ok), grey: '71717A',
}
const STATUS_COLOR = { 'sous-charge': C.gold, conforme: C.green, surcharge: C.red } as const
// Mêmes couleurs de piliers que l'anneau de l'app (vue Semaine)
const PILLAR_FILL = { rugby: C.red, physique: C.gold, accompagnement: C.green, ppid: C.grey } as const
export const DISPLAY = 'Arial Narrow' // titres et chiffres : étroite et grasse, fournie avec Office sur PC et Mac
export const FONT = 'Arial'

export type Deck = { pptx: PptxGenJS; crest: string | null; cover: string | null }

// Images de public/, lues sur notre propre domaine et passées en données (aucun appel vers un tiers).
// Hors navigateur (test), pas d'adresse relative : diapos sans logo.
async function asset(path: string) {
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return `image/png;base64,${btoa(bin)}`
  } catch { return null }
}

export async function deck(): Promise<Deck> {
  const { default: Pptx } = await import('pptxgenjs')
  const pptx = new Pptx()
  pptx.layout = 'LAYOUT_WIDE' // 13,33 × 7,5 pouces
  pptx.author = 'Rouen Normandie Rugby — Pôle Espoir PER'
  const [crest, cover] = await Promise.all([asset('/report-crest.png'), asset('/report-cover.png')])
  return { pptx, crest, cover }
}

const footer = (s: PptxGenJS.Slide, d: Deck) => {
  s.addShape(d.pptx.ShapeType.rect, { x: 0.6, y: 6.95, w: 12.13, h: 0.01, fill: { color: C.line }, line: { color: C.line } })
  s.addText('Rouen Normandie Rugby · Pôle Espoir', { x: 0.6, y: 7.0, w: 6, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted })
  s.addText(`Généré le ${formatDay(parisDate())}`, { x: 6.73, y: 7.0, w: 6, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted, align: 'right' })
}

// Diapo de contenu : titre, trait rouge (comme l'onglet actif de l'app), phrase de lecture, blason, pied de page
export function slide(d: Deck, title: string, subtitle?: string) {
  const s = d.pptx.addSlide()
  s.background = { color: C.bg }
  s.addText(title, { x: 0.6, y: 0.32, w: 11, h: 0.7, fontFace: DISPLAY, fontSize: 30, bold: true, color: C.ink, margin: 0 })
  s.addShape(d.pptx.ShapeType.rect, { x: 0.6, y: 1.05, w: 0.7, h: 0.06, fill: { color: C.red }, line: { color: C.red } })
  if (subtitle) s.addText(subtitle, { x: 0.6, y: 1.18, w: 11, h: 0.5, fontFace: FONT, fontSize: 13, color: C.muted, margin: 0, valign: 'top' })
  if (d.crest) s.addImage({ data: d.crest, x: 12.12, y: 0.3, w: 0.61, h: 0.75 })
  footer(s, d)
  return s
}

// Couverture : logo Pôle Espoir à gauche, titre et chiffres clés à droite
export function coverSlide(d: Deck, kicker: string, title: string, period: string) {
  const s = d.pptx.addSlide()
  s.background = { color: C.cover }
  if (d.cover) s.addImage({ data: d.cover, x: 0.45, y: 1.3, w: 5.4, h: 4.57 })
  else s.addText('Rouen Normandie Rugby\nPôle Espoir', { x: 0.6, y: 2.6, w: 5.2, h: 2, fontFace: DISPLAY, fontSize: 36, bold: true, color: C.ink })
  s.addShape(d.pptx.ShapeType.rect, { x: 6.3, y: 0.6, w: 0.03, h: 6.1, fill: { color: C.line }, line: { color: C.line } })
  s.addText(kicker, { x: 6.75, y: 0.7, w: 6, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.red, margin: 0 })
  s.addText(title, { x: 6.75, y: 1.1, w: 6.1, h: 1.0, fontFace: DISPLAY, fontSize: 40, bold: true, color: C.ink, margin: 0, fit: 'shrink' })
  s.addText(period, { x: 6.75, y: 2.1, w: 6.1, h: 0.5, fontFace: FONT, fontSize: 15, color: C.soft, margin: 0 })
  footer(s, d)
  return s
}

// Chiffres clés sans encadré : grand chiffre, libellé dessous, filet à gauche (comme les indicateurs de l'app)
export function kpis(s: PptxGenJS.Slide, d: Deck, items: { value: string; label: string; color?: string }[],
  { x = 6.75, y = 2.9, w = 6.0, cols = 2, rowH = 1.0 } = {}) {
  const cw = w / cols
  items.forEach((k, i) => {
    const cx = x + (i % cols) * cw, cy = y + Math.floor(i / cols) * rowH
    s.addShape(d.pptx.ShapeType.rect, { x: cx, y: cy + 0.08, w: 0.03, h: rowH - 0.25, fill: { color: k.color ?? C.line }, line: { color: k.color ?? C.line } })
    s.addText(k.value, { x: cx + 0.18, y: cy, w: cw - 0.25, h: 0.55, fontFace: DISPLAY, fontSize: 30, bold: true, color: k.color ?? C.ink, margin: 0, fit: 'shrink' })
    s.addText(k.label, { x: cx + 0.18, y: cy + 0.52, w: cw - 0.25, h: 0.35, fontFace: FONT, fontSize: 11, color: C.muted, margin: 0, valign: 'top' })
  })
}

export const empty = (s: PptxGenJS.Slide, text: string) =>
  s.addText(text, { x: 0.6, y: 3.3, w: 12.2, h: 0.6, align: 'center', fontFace: FONT, fontSize: 16, color: C.muted })

// Graphiques sur fond sombre : axes discrets, étiquettes claires
export const chart = {
  catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT, catAxisLabelFontSize: 12, valAxisLabelFontSize: 10,
  catAxisLabelColor: C.soft, valAxisLabelColor: C.muted, catAxisLineColor: C.line, valAxisLineShow: false,
  valGridLine: { color: C.line, size: 0.5 }, catGridLine: { style: 'none' as const },
  legendFontFace: FONT, legendFontSize: 11, legendColor: C.soft,
  dataLabelFontFace: FONT, dataLabelColor: C.ink, valAxisTitleColor: C.muted, valAxisTitleFontFace: FONT,
  plotArea: { fill: { color: C.bg } }, chartArea: { fill: { color: C.bg } },
}
export const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('fr-FR')} %`)
const kg = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('fr-FR')} kg`)
export const table = (header: string[], rows: (string | number)[][]) => [
  header.map(h => ({ text: h, options: { bold: true, color: C.gold, fill: { color: C.surface } } })),
  ...rows.map((r, i) => r.map(c => ({ text: String(c), options: { fill: { color: i % 2 ? C.surface : C.bg } } }))),
]
export const tableStyle = { fontFace: FONT, fontSize: 12, color: C.ink, border: { type: 'solid' as const, color: C.line, pt: 0.5 }, valign: 'middle' as const }

export async function downloadCycleReport(r: ReturnType<typeof cycleReport>, fileName: string) {
  const d = await deck()
  const { pptx } = d

  // 1. Couverture et chiffres clés
  // « Bilan de cycle » est déjà au-dessus du titre : le nom du joueur seul en grand
  const cover = coverSlide(d, 'Bilan de cycle', r.title.replace(/^Bilan de cycle\s*[—-]\s*/, ''), `${r.period}${r.cycle ? ` · ${r.cycle}` : ''}`)
  const s = r.summary
  kpis(cover, d, [
    { value: String(s.sessions), label: 'séances programmées' },
    { value: `${s.completionPct} %`, label: `exercices faits (${s.done}/${s.exercises})`, color: s.completionPct >= 80 ? C.green : s.completionPct >= 50 ? C.gold : C.red },
    { value: s.sessionRpe === null ? '—' : String(s.sessionRpe).replace('.', ','), label: 'RPE de séance moyen' },
    { value: `${s.respected}`, label: `charges respectées (${s.partial} part., ${s.notRespected} non)`, color: s.respected ? C.green : undefined },
  ])
  if (r.summary.hardest) cover.addText([
    { text: 'Exercice le plus dur  ', options: { color: C.muted } },
    { text: `${r.summary.hardest.name} · RPE ${r.summary.hardest.rpe}`, options: { color: C.ink, bold: true } },
  ], { x: 6.75, y: 5.2, w: 6, h: 0.4, fontFace: FONT, fontSize: 14, margin: 0 })

  // 2. Objectifs chiffrés : 1RM estimée (Epley) sur l'exercice lié, comparée à l'objectif
  const goals = slide(d, 'Objectifs du cycle',
    '1RM estimée (formule d\'Epley : charge × (1 + reps/30), jusqu\'à 10 reps) à partir de la meilleure série de chaque séance — une estimation, pas un test')
  const work = (p: { load: number; reps: number | null } | null) => (p ? `${kg(p.load)}${p.reps ? ` × ${p.reps}` : ''}` : '—')
  if (!r.objectives.length) empty(goals, 'Aucun objectif chiffré pour ce joueur cette saison.')
  else {
    goals.addTable(table(['Objectif', 'Exercice suivi', 'Début du cycle', 'Fin du cycle', 'Gain (1RM est.)', '1RM estimée max', '% de l\'objectif'],
      r.objectives.map(o => [`${o.test} : ${o.value.toLocaleString('fr-FR')}${o.label ? ` (${o.label})` : ''}`, o.exercise ?? 'non lié',
        work(o.first), work(o.last), o.gainPct === null ? '—' : `${o.gainPct > 0 ? '+' : ''}${pct(o.gainPct)}`, kg(o.bestE1rm), pct(o.targetPct)])),
    { ...tableStyle, x: 0.6, y: 1.85, w: 12.13, colW: [3.2, 2.2, 1.4, 1.4, 1.3, 1.3, 1.33], autoPage: true })
    // Graphique seulement s'il tient sous le tableau (au-delà de 4 objectifs, le tableau suffit)
    const linked = r.objectives.filter(o => o.bestE1rm !== null)
    if (linked.length && r.objectives.length <= 4) goals.addChart(pptx.ChartType.bar, [
      { name: '1RM estimée (max du cycle)', labels: linked.map(o => o.test), values: linked.map(o => o.bestE1rm!) },
      { name: 'Objectif', labels: linked.map(o => o.test), values: linked.map(o => o.value) },
    ], { ...chart, x: 0.6, y: 2.4 + 0.45 * (r.objectives.length + 1), w: 12.13, h: 4.45 - 0.45 * (r.objectives.length + 1),
      barGrouping: 'clustered', barGapWidthPct: 60, chartColors: [C.red, C.grey], showLegend: true, legendPos: 'b', showValue: true, dataLabelFontSize: 11, valAxisTitle: 'kg' })
  }

  // 3. Courbes de progression des mouvements prioritaires (1RM estimée par séance)
  const tracked = r.objectives.filter(o => o.points.filter(p => p.e1rm !== null).length > 1)
  const prog = slide(d, 'Progression des mouvements prioritaires', tracked.length
    ? '1RM estimée à chaque séance (meilleure série), exercices liés aux objectifs' : 'Pas assez de séances renseignées sur les mouvements des objectifs')
  if (tracked.length) {
    const dates = [...new Set(tracked.flatMap(o => o.points.map(p => p.date)))].sort()
    prog.addChart(pptx.ChartType.line, tracked.map(o => ({
      name: o.exercise!, labels: dates.map(d => formatDay(d).replace(/ \d{4}$/, '')),
      values: dates.map(d => o.points.find(p => p.date === d)?.e1rm ?? null) as number[],
    })), { ...chart, x: 0.6, y: 1.8, w: 12.13, h: 5.0, chartColors: [C.red, C.gold, C.ink, C.green], lineSize: 3, lineDataSymbolSize: 8,
      catAxisLabelFontSize: 10, showLegend: true, legendPos: 'b', valAxisTitle: 'kg (1RM estimée)', showValAxisTitle: true, displayBlanksAs: 'span' })
  } else empty(prog, 'Lie chaque objectif à son exercice et renseigne les charges réalisées pour voir les courbes.')

  // 4. Plus gros exercices et leur RPE moyen
  const heavy = slide(d, 'Plus gros exercices du cycle', 'Meilleure charge réalisée et RPE moyen déclaré par le joueur')
  if (!r.heaviest.length) empty(heavy, 'Aucune charge réalisée renseignée sur la période.')
  else {
    const top = [...r.heaviest].reverse() // barres horizontales : PowerPoint dessine la première catégorie en bas
    heavy.addChart(pptx.ChartType.bar, [{
      name: 'Meilleure charge (kg)', labels: top.map(h => `${h.name}${h.rpe === null ? '' : ` · RPE ${String(h.rpe).replace('.', ',')}`}`), values: top.map(h => h.best),
    }], { ...chart, x: 0.6, y: 1.8, w: 12.13, h: 5.0, barDir: 'bar', barGapWidthPct: 45, chartColors: [C.red], showValue: true, dataLabelFontSize: 13, catAxisLabelFontSize: 13 })
  }

  // 5. Charge hebdomadaire du joueur
  const load = slide(d, 'Charge d\'entraînement par semaine', 'sRPE total (RPE × minutes, toutes activités) comparé à la cible de la semaine')
  load.addChart(pptx.ChartType.bar, [
    { name: 'Charge réalisée (UA)', labels: r.weekly.map(w => w.code), values: r.weekly.map(w => w.total) },
    { name: 'Cible (UA)', labels: r.weekly.map(w => w.code), values: r.weekly.map(w => w.target) },
  ], { ...chart, x: 0.6, y: 1.8, w: 12.13, h: 5.0, barGrouping: 'clustered', barGapWidthPct: 60, chartColors: [C.red, C.grey], showLegend: true, legendPos: 'b', showValue: true, dataLabelFontSize: 10 })

  await pptx.writeFile({ fileName })
}

export async function downloadWeekReport(
  r: ReturnType<typeof weekReport>, week: { code: string; label: string | null; start_date: string },
  wt: WeekType | null, logs: Log[], types: ActivityType[], fileName: string,
) {
  const d = await deck()
  const { pptx } = d
  const { m, counts } = r
  const period = `Semaine du ${formatDay(week.start_date)}${wt ? ` · ${wt.name} · plage ${rangeLabel(wt)}` : ''}${m.inProgress ? ' · semaine en cours' : ''}`

  // 1. Couverture et chiffres clés
  const cover = coverSlide(d, 'Résumé collectif', week.label || week.code, period)
  const color = m.groupStatus ? STATUS_COLOR[m.groupStatus] : undefined
  kpis(cover, d, [
    { value: `${m.groupMean.toLocaleString('fr-FR')} UA`, label: 'charge moyenne du groupe', color },
    { value: `${(wt?.target_srpe ?? 0).toLocaleString('fr-FR')} UA`, label: 'charge visée' },
    { value: pct(m.groupPct), label: 'de la cible atteinte', color },
    { value: m.groupStatus ?? (m.inProgress ? 'en cours' : '—'), label: 'statut collectif', color },
    { value: String(counts.ok), label: 'joueurs dans la plage', color: C.green },
    { value: String(counts.under), label: 'en sous-charge', color: C.gold },
    { value: String(counts.over), label: 'en surcharge', color: C.red },
    { value: String(counts.injured), label: 'blessés (hors calcul)', color: C.grey },
  ], { y: 2.8, rowH: 0.98 })

  // 2. Charge par joueur, couleur selon le statut (séries empilées : une par statut)
  const players = slide(d, 'Charge par joueur', `sRPE total de la semaine${wt ? ` · plage visée ${rangeLabel(wt)}` : ''} · or : sous-charge, vert : dans la plage, rouge : surcharge, gris : blessé ou semaine en cours`)
  const ordered = [...r.players].reverse() // le plus chargé en haut (PowerPoint dessine la première catégorie en bas)
  const labels = ordered.map(p => p.name)
  const serie = (name: string, keep: (p: typeof r.players[number]) => boolean) =>
    ({ name, labels, values: ordered.map(p => (keep(p) ? p.total : 0)) })
  players.addChart(pptx.ChartType.bar, [
    serie('Sous-charge', p => !p.injured && p.status === 'sous-charge'),
    serie('Dans la plage', p => !p.injured && p.status === 'conforme'),
    serie('Surcharge', p => !p.injured && p.status === 'surcharge'),
    serie('Blessé / en cours', p => p.injured || p.status === null),
  ], { ...chart, x: 0.6, y: 1.8, w: 12.13, h: 5.05, barDir: 'bar', barGrouping: 'stacked', barGapWidthPct: 35, chartColors: [C.gold, C.green, C.red, C.grey],
    catAxisLabelFontSize: Math.max(8, Math.min(12, Math.floor(160 / Math.max(1, labels.length)))), showLegend: true, legendPos: 'b' })

  // 3. Jour par jour
  const days = dailySynthesis(logs, types, week.start_date)
  const daySlide = slide(d, 'Jour par jour', 'Charge moyenne par joueur ayant déclaré (sRPE) et nombre de déclarants')
  daySlide.addChart(pptx.ChartType.bar, [{ name: 'sRPE moyen (UA)', labels: DAY_NAMES, values: days.map(d => d.avgSrpe) }],
    { ...chart, x: 0.6, y: 1.8, w: 12.13, h: 3.4, barGapWidthPct: 55, chartColors: [C.red], showValue: true, dataLabelFontSize: 12 })
  daySlide.addTable(table(['', ...DAY_NAMES], [
    ['Déclarants', ...days.map(d => d.declarants)],
    ['Durée moyenne (min)', ...days.map(d => d.avgMinutes)],
    ['Intensité (UA/min)', ...days.map(d => String(d.intensity).replace('.', ','))],
  ]), { ...tableStyle, fontSize: 11, x: 0.6, y: 5.4, w: 12.13, colW: [2.33, ...DAY_NAMES.map(() => 1.4)], align: 'center' })

  // 4. Répartition par pilier : anneau du temps réalisé (couleurs des piliers de l'app), cible et écart en légende chiffrée
  const pillars = pillarSplit(logs, types, wt)
  const split = slide(d, 'Répartition de l\'activité', 'Part du temps d\'entraînement par pilier ; la préconisation du type de semaine et l\'écart à droite')
  const done = pillars.filter(p => p.pct > 0) // une part nulle ne se dessine pas, elle reste dans la légende
  if (done.length) split.addChart(pptx.ChartType.doughnut, [
    { name: 'Réalisé (%)', labels: done.map(p => PILLAR_LABEL[p.pillar]), values: done.map(p => p.pct) },
  ], { ...chart, x: 0.6, y: 1.75, w: 6.2, h: 5.05, holeSize: 55, chartColors: done.map(p => PILLAR_FILL[p.pillar]),
    dataBorder: { pt: 2, color: C.bg }, showLegend: false, showValue: false, showPercent: true, showLabel: false,
    dataLabelColor: C.ink, dataLabelFontSize: 14, dataLabelFontBold: true })
  else empty(split, 'Aucune activité déclarée cette semaine.')
  pillars.forEach((p, i) => {
    const y = 2.1 + i * 1.15, gap = p.pct - p.targetPct
    split.addShape(pptx.ShapeType.rect, { x: 7.3, y: y + 0.08, w: 0.22, h: 0.22, fill: { color: PILLAR_FILL[p.pillar] }, line: { color: PILLAR_FILL[p.pillar] } })
    split.addText(PILLAR_LABEL[p.pillar], { x: 7.7, y, w: 5, h: 0.38, fontFace: DISPLAY, fontSize: 18, bold: true, color: C.ink, margin: 0 })
    split.addText([
      { text: `${pct(p.pct)} réalisé`, options: { color: C.ink, bold: true } },
      { text: `  ·  ${pct(p.targetPct)} préconisé  ·  `, options: { color: C.muted } },
      // écart en points de pourcentage (18,8 % contre 25 % = −6,2 pts), pas en %
      { text: `${gap > 0 ? '+' : ''}${(Math.round(gap * 10) / 10).toLocaleString('fr-FR')} pts`, options: { color: Math.abs(gap) <= 5 ? C.green : C.gold, bold: true } },
    ], { x: 7.7, y: y + 0.4, w: 5, h: 0.35, fontFace: FONT, fontSize: 13, margin: 0 })
  })

  // 5. Points d'attention : trois colonnes, chacune ouverte par un trait de sa couleur
  const alerts = slide(d, 'Points d\'attention', m.inProgress ? 'Semaine en cours : statuts disponibles une fois la semaine terminée' : 'Joueurs hors de la plage visée (blessés exclus)')
  const list = (title: string, names: string[], c: string, x: number) => {
    alerts.addShape(pptx.ShapeType.rect, { x, y: 1.85, w: 3.85, h: 0.06, fill: { color: c }, line: { color: c } })
    alerts.addText([
      { text: `${title}  `, options: { bold: true, color: C.ink, fontSize: 18, fontFace: DISPLAY } },
      { text: String(names.length), options: { bold: true, color: c, fontSize: 18, fontFace: DISPLAY, breakLine: true } },
      ...(names.length ? names : ['—']).map(n => ({ text: n, options: { color: C.soft, fontSize: 12, breakLine: true } })),
    ], { x, y: 2.0, w: 3.85, h: 4.8, valign: 'top', fontFace: FONT, margin: 0, paraSpaceAfter: 3 })
  }
  list('Sous-charge', r.players.filter(p => !p.injured && p.status === 'sous-charge').map(p => `${p.name} · ${p.total.toLocaleString('fr-FR')} UA`), C.gold, 0.6)
  list('Surcharge', r.players.filter(p => !p.injured && p.status === 'surcharge').map(p => `${p.name} · ${p.total.toLocaleString('fr-FR')} UA`), C.red, 4.74)
  list('Blessés', r.players.filter(p => p.injured).map(p => p.name), C.grey, 8.88)

  await pptx.writeFile({ fileName })
}

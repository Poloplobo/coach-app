// Extractions PowerPoint (étape 9) : bilan de cycle d'un joueur, résumé collectif d'une semaine.
// Fichier créé dans le navigateur (pptxgenjs chargé au clic) : aucune donnée ne passe par un service tiers.
// Graphiques natifs, modifiables dans PowerPoint / Keynote / Google Slides.
import type PptxGenJS from 'pptxgenjs'
import { BRAND } from '../../lib/brand'
import { formatDay, parisDate } from '../../lib/week'
import { DAY_NAMES, dailySynthesis, pillarSplit, rangeLabel, type ActivityType, type Log, type WeekType } from './load'
import { PILLAR_LABEL } from './exportWeek'
import type { cycleReport, weekReport } from './report'

const hex = (c: string) => c.replace('#', '')
const INK = '1A1A1A', GREY = '6B7280', LINE = 'E5E7EB', RED = hex(BRAND.rnr), GREEN = hex(BRAND.ok), MUTED = hex(BRAND.muted)
// Textes sur fond blanc : versions foncées (contraste lisible) ; couleurs vives réservées aux barres
const GREEN_TEXT = '047857'
// L'or de la charte (#FFD700) est illisible sur fond blanc : or foncé pour les textes et barres des diapos
const GOLD = 'B8860B'
const STATUS_COLOR = { 'sous-charge': GOLD, conforme: GREEN, surcharge: RED } as const
const FONT = 'Arial'

async function deck() {
  const { default: Pptx } = await import('pptxgenjs')
  const pptx = new Pptx()
  pptx.layout = 'LAYOUT_WIDE' // 13,33 × 7,5 pouces
  pptx.author = 'Rouen Normandie Rugby — Pôle Espoir PER'
  return pptx
}

// Cadre commun : liseré rouge, titre, sous-titre, pied de page
function slide(pptx: PptxGenJS, title: string, subtitle?: string) {
  const s = pptx.addSlide()
  s.background = { color: 'FFFFFF' }
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: RED }, line: { color: RED } })
  s.addText(title, { x: 0.6, y: 0.35, w: 12.2, h: 0.6, fontFace: FONT, fontSize: 26, bold: true, color: INK })
  if (subtitle) s.addText(subtitle, { x: 0.6, y: 0.95, w: 12.2, h: 0.4, fontFace: FONT, fontSize: 14, color: GREY })
  s.addText(`Rouen Normandie Rugby · Pôle Espoir PER · généré le ${formatDay(parisDate())}`,
    { x: 0.6, y: 7.0, w: 12.2, h: 0.3, fontFace: FONT, fontSize: 9, color: GREY })
  return s
}

function kpis(s: PptxGenJS.Slide, pptx: PptxGenJS, items: { value: string; label: string; color?: string }[], y = 1.7) {
  const w = (12.2 - 0.3 * (items.length - 1)) / items.length
  items.forEach((k, i) => {
    const x = 0.6 + i * (w + 0.3)
    s.addShape(pptx.ShapeType.rect, { x, y, w, h: 1.5, fill: { color: 'F7F7F7' }, line: { color: LINE } })
    s.addText(k.value, { x, y: y + 0.15, w, h: 0.8, align: 'center', fontFace: FONT, fontSize: 32, bold: true, color: k.color ?? INK })
    s.addText(k.label, { x, y: y + 0.95, w, h: 0.45, align: 'center', fontFace: FONT, fontSize: 12, color: GREY })
  })
}

const empty = (s: PptxGenJS.Slide, text: string) =>
  s.addText(text, { x: 0.6, y: 3.2, w: 12.2, h: 0.6, align: 'center', fontFace: FONT, fontSize: 16, color: GREY })

const axis = { catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT, catAxisLabelFontSize: 11, valAxisLabelFontSize: 10,
  catAxisLabelColor: GREY, valAxisLabelColor: GREY, valGridLine: { color: LINE, size: 0.5 }, legendFontFace: FONT, legendFontSize: 11 }
const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('fr-FR')} %`)
const kg = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('fr-FR')} kg`)
const table = (header: string[], rows: (string | number)[][]) => [
  header.map(h => ({ text: h, options: { bold: true, color: 'FFFFFF', fill: { color: INK } } })),
  ...rows.map(r => r.map(c => ({ text: String(c) }))),
]
const tableStyle = { fontFace: FONT, fontSize: 12, color: INK, border: { type: 'solid' as const, color: LINE, pt: 0.75 }, valign: 'middle' as const }

export async function downloadCycleReport(r: ReturnType<typeof cycleReport>, fileName: string) {
  const pptx = await deck()

  // 1. Couverture et chiffres clés
  const cover = slide(pptx, r.title, `${r.period}${r.cycle ? ` · ${r.cycle}` : ''}`)
  const s = r.summary
  kpis(cover, pptx, [
    { value: String(s.sessions), label: 'séances programmées' },
    { value: `${s.completionPct} %`, label: `exercices faits (${s.done}/${s.exercises})`, color: s.completionPct >= 80 ? GREEN_TEXT : s.completionPct >= 50 ? GOLD : RED },
    { value: s.sessionRpe === null ? '—' : String(s.sessionRpe).replace('.', ','), label: 'RPE de séance moyen' },
    { value: `${s.respected}`, label: `charges respectées (${s.partial} part., ${s.notRespected} non)`, color: s.respected ? GREEN_TEXT : INK },
  ])
  cover.addText(r.summary.hardest ? `Exercice le plus dur : ${r.summary.hardest.name} (RPE ${r.summary.hardest.rpe})` : '',
    { x: 0.6, y: 3.6, w: 12.2, h: 0.4, fontFace: FONT, fontSize: 14, color: INK })

  // 2. Objectifs chiffrés : 1RM estimée (Epley) sur l'exercice lié, comparée à l'objectif
  const goals = slide(pptx, 'Objectifs du cycle',
    '1RM estimée (formule d\'Epley : charge × (1 + reps/30), jusqu\'à 10 reps) à partir de la meilleure série de chaque séance — une estimation, pas un test')
  const work = (p: { load: number; reps: number | null } | null) => (p ? `${kg(p.load)}${p.reps ? ` × ${p.reps}` : ''}` : '—')
  if (!r.objectives.length) empty(goals, 'Aucun objectif chiffré pour ce joueur cette saison.')
  else {
    goals.addTable(table(['Objectif', 'Exercice suivi', 'Début du cycle', 'Fin du cycle', 'Gain (1RM est.)', '1RM estimée max', '% de l\'objectif'],
      r.objectives.map(o => [`${o.test} : ${o.value.toLocaleString('fr-FR')}${o.label ? ` (${o.label})` : ''}`, o.exercise ?? 'non lié',
        work(o.first), work(o.last), o.gainPct === null ? '—' : `${o.gainPct > 0 ? '+' : ''}${pct(o.gainPct)}`, kg(o.bestE1rm), pct(o.targetPct)])),
    { ...tableStyle, x: 0.6, y: 1.6, w: 12.2, colW: [3.2, 2.2, 1.4, 1.4, 1.3, 1.3, 1.4], autoPage: true })
    // Graphique seulement s'il tient sous le tableau (au-delà de 4 objectifs, le tableau suffit)
    const linked = r.objectives.filter(o => o.bestE1rm !== null)
    if (linked.length && r.objectives.length <= 4) goals.addChart(pptx.ChartType.bar, [
      { name: '1RM estimée (max du cycle)', labels: linked.map(o => o.test), values: linked.map(o => o.bestE1rm!) },
      { name: 'Objectif', labels: linked.map(o => o.test), values: linked.map(o => o.value) },
    ], { ...axis, x: 0.6, y: 2.2 + 0.5 * (r.objectives.length + 1), w: 12.2, h: 4.6 - 0.5 * (r.objectives.length + 1),
      barGrouping: 'clustered', chartColors: [RED, MUTED], showLegend: true, legendPos: 'b', showValue: true, dataLabelFontSize: 10, valAxisTitle: 'kg' })
  }

  // 3. Courbes de progression des mouvements prioritaires (1RM estimée par séance)
  const tracked = r.objectives.filter(o => o.points.filter(p => p.e1rm !== null).length > 1)
  const prog = slide(pptx, 'Progression des mouvements prioritaires', tracked.length
    ? '1RM estimée à chaque séance (meilleure série), exercices liés aux objectifs' : 'Pas assez de séances renseignées sur les mouvements des objectifs')
  if (tracked.length) {
    const dates = [...new Set(tracked.flatMap(o => o.points.map(p => p.date)))].sort()
    prog.addChart(pptx.ChartType.line, tracked.map(o => ({
      name: o.exercise!, labels: dates.map(d => formatDay(d).replace(/ \d{4}$/, '')),
      values: dates.map(d => o.points.find(p => p.date === d)?.e1rm ?? null) as number[],
    })), { ...axis, x: 0.6, y: 1.5, w: 12.2, h: 5.3, chartColors: [RED, INK, GOLD, GREEN], lineSize: 3, lineDataSymbolSize: 8,
      showLegend: true, legendPos: 'b', valAxisTitle: 'kg (1RM estimée)', showValAxisTitle: true, displayBlanksAs: 'span' })
  } else empty(prog, 'Lie chaque objectif à son exercice et renseigne les charges réalisées pour voir les courbes.')

  // 4. Plus gros exercices et leur RPE moyen
  const heavy = slide(pptx, 'Plus gros exercices du cycle', 'Meilleure charge réalisée et RPE moyen déclaré par le joueur')
  if (!r.heaviest.length) empty(heavy, 'Aucune charge réalisée renseignée sur la période.')
  else {
    const top = [...r.heaviest].reverse() // barres horizontales : PowerPoint dessine la première catégorie en bas
    heavy.addChart(pptx.ChartType.bar, [{
      name: 'Meilleure charge (kg)', labels: top.map(h => `${h.name}${h.rpe === null ? '' : ` · RPE ${String(h.rpe).replace('.', ',')}`}`), values: top.map(h => h.best),
    }], { ...axis, x: 0.6, y: 1.5, w: 12.2, h: 5.3, barDir: 'bar', chartColors: [RED], showValue: true, dataLabelFontSize: 12, catAxisLabelFontSize: 13 })
  }

  // 5. Charge hebdomadaire du joueur
  const load = slide(pptx, 'Charge d\'entraînement par semaine', 'sRPE total (RPE × minutes, toutes activités) comparé à la cible de la semaine')
  load.addChart(pptx.ChartType.bar, [
    { name: 'Charge réalisée (UA)', labels: r.weekly.map(w => w.code), values: r.weekly.map(w => w.total) },
    { name: 'Cible (UA)', labels: r.weekly.map(w => w.code), values: r.weekly.map(w => w.target) },
  ], { ...axis, x: 0.6, y: 1.5, w: 12.2, h: 5.3, barGrouping: 'clustered', chartColors: [RED, MUTED], showLegend: true, legendPos: 'b', showValue: true, dataLabelFontSize: 10 })

  await pptx.writeFile({ fileName })
}

export async function downloadWeekReport(
  r: ReturnType<typeof weekReport>, week: { code: string; label: string | null; start_date: string },
  wt: WeekType | null, logs: Log[], types: ActivityType[], fileName: string,
) {
  const pptx = await deck()
  const { m, counts } = r
  const subtitle = `Semaine du ${formatDay(week.start_date)}${wt ? ` · ${wt.name} · plage ${rangeLabel(wt)}` : ''}${m.inProgress ? ' · semaine en cours' : ''}`

  // 1. Chiffres clés
  const cover = slide(pptx, `Résumé collectif — ${week.label || week.code}`, subtitle)
  const color = m.groupStatus ? { ...STATUS_COLOR, conforme: GREEN_TEXT }[m.groupStatus] : INK
  kpis(cover, pptx, [
    { value: `${m.groupMean.toLocaleString('fr-FR')} UA`, label: 'charge moyenne du groupe', color },
    { value: `${(wt?.target_srpe ?? 0).toLocaleString('fr-FR')} UA`, label: 'charge visée' },
    { value: pct(m.groupPct), label: 'de la cible atteinte', color },
    { value: m.groupStatus ?? (m.inProgress ? 'en cours' : '—'), label: 'statut collectif', color },
  ])
  kpis(cover, pptx, [
    { value: String(counts.ok), label: 'joueurs dans la plage', color: GREEN_TEXT },
    { value: String(counts.under), label: 'en sous-charge', color: GOLD },
    { value: String(counts.over), label: 'en surcharge', color: RED },
    { value: String(counts.injured), label: 'blessés (hors calcul)', color: GREY },
  ], 3.6)

  // 2. Charge par joueur, couleur selon le statut (séries empilées : une par statut)
  const players = slide(pptx, 'Charge par joueur', `sRPE total de la semaine${wt ? ` · plage visée ${rangeLabel(wt)}` : ''} · or : sous-charge, vert : dans la plage, rouge : surcharge, gris : blessé ou semaine en cours`)
  const ordered = [...r.players].reverse() // le plus chargé en haut (PowerPoint dessine la première catégorie en bas)
  const labels = ordered.map(p => p.name)
  const serie = (name: string, keep: (p: typeof r.players[number]) => boolean) =>
    ({ name, labels, values: ordered.map(p => (keep(p) ? p.total : 0)) })
  players.addChart(pptx.ChartType.bar, [
    serie('Sous-charge', p => !p.injured && p.status === 'sous-charge'),
    serie('Dans la plage', p => !p.injured && p.status === 'conforme'),
    serie('Surcharge', p => !p.injured && p.status === 'surcharge'),
    serie('Blessé / en cours', p => p.injured || p.status === null),
  ], { ...axis, x: 0.6, y: 1.5, w: 12.2, h: 5.4, barDir: 'bar', barGrouping: 'stacked', chartColors: [GOLD, GREEN, RED, MUTED],
    catAxisLabelFontSize: Math.max(8, Math.min(12, Math.floor(160 / Math.max(1, labels.length)))), showLegend: true, legendPos: 'b' })

  // 3. Jour par jour
  const days = dailySynthesis(logs, types, week.start_date)
  const daySlide = slide(pptx, 'Jour par jour', 'Charge moyenne par joueur ayant déclaré (sRPE) et nombre de déclarants')
  daySlide.addChart(pptx.ChartType.bar, [{ name: 'sRPE moyen (UA)', labels: DAY_NAMES, values: days.map(d => d.avgSrpe) }],
    { ...axis, x: 0.6, y: 1.5, w: 12.2, h: 3.6, chartColors: [RED], showValue: true, dataLabelFontSize: 11 })
  daySlide.addTable(table(['', ...DAY_NAMES], [
    ['Déclarants', ...days.map(d => d.declarants)],
    ['Durée moyenne (min)', ...days.map(d => d.avgMinutes)],
    ['Intensité (UA/min)', ...days.map(d => String(d.intensity).replace('.', ','))],
  ]), { ...tableStyle, fontSize: 11, x: 0.6, y: 5.3, w: 12.2, colW: [2.4, ...DAY_NAMES.map(() => 1.4)], align: 'center' })

  // 4. Répartition par pilier
  const pillars = pillarSplit(logs, types, wt)
  const split = slide(pptx, 'Répartition de l\'activité', 'Part du temps d\'entraînement par pilier, comparée aux préconisations du type de semaine')
  split.addChart(pptx.ChartType.bar, [
    { name: 'Réalisé (%)', labels: pillars.map(p => PILLAR_LABEL[p.pillar]), values: pillars.map(p => p.pct) },
    { name: 'Préconisé (%)', labels: pillars.map(p => PILLAR_LABEL[p.pillar]), values: pillars.map(p => p.targetPct) },
  ], { ...axis, x: 0.6, y: 1.5, w: 12.2, h: 5.3, barGrouping: 'clustered', chartColors: [RED, MUTED], showLegend: true, legendPos: 'b', showValue: true, dataLabelFontSize: 11 })

  // 5. Points d'attention
  const alerts = slide(pptx, 'Points d\'attention', m.inProgress ? 'Semaine en cours : statuts disponibles une fois la semaine terminée' : 'Joueurs hors de la plage visée (blessés exclus)')
  const list = (title: string, names: string[], c: string, x: number) => alerts.addText([
    { text: `${title} (${names.length})`, options: { bold: true, color: c, fontSize: 16, breakLine: true } },
    ...(names.length ? names : ['—']).map(n => ({ text: n, options: { color: INK, fontSize: 13, breakLine: true } })),
  ], { x, y: 1.6, w: 3.9, h: 5.2, valign: 'top', fontFace: FONT })
  list('Sous-charge', r.players.filter(p => !p.injured && p.status === 'sous-charge').map(p => `${p.name} · ${p.total} UA`), GOLD, 0.6)
  list('Surcharge', r.players.filter(p => !p.injured && p.status === 'surcharge').map(p => `${p.name} · ${p.total} UA`), RED, 4.75)
  list('Blessés', r.players.filter(p => p.injured).map(p => p.name), GREY, 8.9)

  await pptx.writeFile({ fileName })
}

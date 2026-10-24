// Export Excel de la semaine : onglet « Collectif » (calque de TABLEAU_DE_BORD) + un onglet par joueur (SUIVI_INDIVIDUEL).
// Mêmes calculs que l'écran (load.ts). Le fichier est créé dans le navigateur : aucune donnée ne passe par un serveur tiers.
import { addDays } from '../../lib/week'
import {
  DAY_NAMES, dailySynthesis, fullName, pctOfTarget, pillarSplit, playerDays, rangeLabel, weekMatrix,
  type ActivityType, type Log, type Player, type WeekType,
} from './load'

export type WeekInfo = { code: string; label: string | null; start_date: string; cycle: string | null }

const pct = (v: number) => `${v.toLocaleString('fr-FR')} %`
const signed = (v: number) => (v > 0 ? `+${v}` : String(v))
export const PILLAR_LABEL = { physique: 'Physique', rugby: 'Rugby', accompagnement: 'Accompagnement de la performance', ppid: 'Besoins individuels (PPID)' }

export function weekRows(week: WeekInfo, wt: WeekType | null, players: Player[], logs: Log[], types: ActivityType[]) {
  const m = weekMatrix(players, logs, week.start_date, wt)
  const synthesis = dailySynthesis(logs, types, week.start_date)
  const pillars = pillarSplit(logs, types, wt)
  const target = wt?.target_srpe ?? 0
  const status = (s: string | null, injured = false) => (injured ? 'Blessé' : s ?? 'Hors calendrier')

  const collective: (string | number)[][] = [
    [`TABLEAU DE BORD COLLECTIF — SUIVI DE LA CHARGE sRPE — ${week.code} (${week.label ?? ''})`],
    [`Semaine du ${week.start_date} · ${week.cycle ?? ''} · ${wt?.name ?? 'Semaine hors calendrier'}${wt ? ` · plage ${rangeLabel(wt)}` : ''}`],
    [],
    ['Charge obtenue (moyenne)', 'Charge visée', '% de la cible (Accurate RPE)', 'Statut charge collective'],
    [m.groupMean, target, pct(m.groupPct), status(m.groupStatus)],
    [],
    ['SYNTHÈSE COLLECTIVE QUOTIDIENNE'],
    ['Jour', 'Athlètes déclarés', 'Durée moyenne déclarée (min)', 'Dont rugby (min)', 'Dont physique (min)', 'sRPE moyen (UA)', 'sRPE cumulé (UA)', 'Intensité (UA/min)'],
    ...synthesis.map(d => [d.day, d.declarants, d.avgMinutes, d.rugbyMinutes, d.physiqueMinutes, d.avgSrpe, d.cumulSrpe, d.intensity]),
    [],
    ['MATRICE INDIVIDUELLE DES JOUEURS'],
    ['NOM Prénom', 'Nb séances', ...DAY_NAMES.map(d => `sRPE ${d}`), 'Total sRPE (UA)', 'sRPE visé (UA)', 'Accurate RPE (%)', 'Écart vs visé (UA)', 'Écart vs groupe (%)', 'Statut'],
    ...m.rows.map(r => [fullName(r.player), r.sessions, ...r.byDay, r.total, target, pct(r.pct), signed(r.gap), `${signed(r.vsGroupPct)} %`, status(r.status, r.player.injured)]),
    ['MOYENNE DU GROUPE (aptes)', '', ...m.dayMeans, m.groupMean, target, pct(m.groupPct), signed(m.groupMean - target), '0 %', status(m.groupStatus)],
    [],
    ['RÉPARTITION PAR PILIER (minutes moyennes par joueur)'],
    ['Pilier', 'Réalisé (min)', 'Réalisé (h)', '% réalisé', '% cible', 'Écart'],
    ...pillars.map(p => [PILLAR_LABEL[p.pillar], p.minutes, Math.round(p.minutes / 6) / 10, pct(p.pct), pct(p.targetPct), `${signed(p.gap)} %`]),
    [],
    ['ANOMALIES DE CHARGE (sous-charge et surcharge, joueurs blessés exclus)'],
    ['NOM Prénom', 'Nb séances', '% de la cible', 'Écart vs visé (UA)', 'Statut'],
    ...m.anomalies.map(r => [fullName(r.player), r.sessions, pct(r.pct), signed(r.gap), status(r.status)]),
  ]

  const individual = m.rows.map(r => {
    const own = logs.filter(l => l.player_id === r.player.id)
    const days = playerDays(own, types, week.start_date, m.dayMeans)
    const rows: (string | number)[][] = [
      [`FICHE ATHLÈTE — ${fullName(r.player)} — ${week.code}`],
      [`Poste : ${r.player.position ?? '—'} · ${wt?.name ?? 'Hors calendrier'} · statut : ${status(r.status, r.player.injured)}`],
      [],
      ['Séances déclarées', 'sRPE total (UA)', 'Accurate RPE', 'Vs moyenne groupe', 'Temps total (min)'],
      [r.sessions, r.total, pct(pctOfTarget(r.total, target)), `${signed(r.vsGroupPct)} %`, r.minutes],
      [],
      ['DÉTAIL JOURNALIER'],
      ['Jour', 'Activités', 'Temps (min)', 'Dont rugby', 'Dont physique', 'Dont vidéo / kiné', 'RPE moyen', 'sRPE (UA)', 'Moyenne groupe (UA)', 'Écart (UA)'],
      ...days.map(d => [d.day, d.activities || '—', d.minutes, d.rugby, d.physique, d.accompagnement, d.avgRpe ?? '—', d.srpe, d.groupMean, signed(d.gap)]),
      ['TOTAL', '', r.minutes, days.reduce((s, d) => s + d.rugby, 0), days.reduce((s, d) => s + d.physique, 0),
        days.reduce((s, d) => s + d.accompagnement, 0), '', r.total, m.groupMean, signed(r.total - m.groupMean)],
      [],
      ['JOURNAL DES DÉCLARATIONS'],
      ['Enregistré le', 'Jour', 'Activité', 'sRPE (UA)', 'Saisi par'],
      ...[...own].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(l => [
        new Date(l.created_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
        DAY_NAMES[(new Date(`${l.session_date}T00:00:00Z`).getUTCDay() + 6) % 7],
        types.find(t => t.id === l.activity_type_id)?.name ?? '—', Number(l.srpe ?? 0),
        { app: 'joueur', staff: 'staff', import_form: 'formulaire' }[l.source] ?? l.source,
      ]),
    ]
    return { name: fullName(r.player), rows }
  })
  return { collective, individual }
}

// Noms d'onglet Excel : 31 caractères maximum, sans : \ / ? * [ ]
const sheetName = (name: string, used: Set<string>) => {
  let base = name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 28)
  for (let i = 2; used.has(base); i++) base = `${name.slice(0, 26)} ${i}`
  used.add(base)
  return base
}

export async function downloadWeek(week: WeekInfo, wt: WeekType | null, players: Player[], logs: Log[], types: ActivityType[]) {
  const XLSX = await import('xlsx') // chargé seulement au clic : l'app reste légère sur mobile
  const { collective, individual } = weekRows(week, wt, players, logs, types)
  const wb = XLSX.utils.book_new()
  const used = new Set<string>()
  const add = (rows: (string | number)[][], name: string) => {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = rows.reduce<number[]>((w, r) => r.map((c, i) => Math.max(w[i] ?? 8, Math.min(60, String(c).length + 2))), []).map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, sheetName(name, used))
  }
  add(collective, 'Collectif')
  for (const p of individual) add(p.rows, p.name)
  XLSX.writeFile(wb, `PER_${week.code}_${week.start_date}.xlsx`)
}

export const weekEnd = (week: WeekInfo) => addDays(week.start_date, 6)

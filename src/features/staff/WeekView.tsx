import { Fragment, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '../../components/ui/Badge'
import { MoreButton } from '../../components/ui/MoreButton'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Kpi } from '../../components/ui/Kpi'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { BRAND } from '../../lib/brand'
import { addDays, parisDate } from '../../lib/week'
import { pct } from '../../lib/format'
import { PILLAR_LABEL, downloadWeek, weekEnd } from './exportWeek'
import {
  DAY_NAMES, STATUS_TONE, dailySynthesis, fullName, hotSessions, missingRpe, pillarSplit, rangeLabel, rpeGap, rpeMatrix, rpeVsTarget, sessionTarget, weekMatrix, weekOf, weekPace,
  type ActivityType, type Heat, type Log, type MatrixRow, type Pillar, type RpeRange, type WeekType,
} from './load'
import { useAllLogs, useAllPlan, useReference, useRoster, useTargetRpes } from './useStaff'
import { EXERCISE_SESSIONS } from '../rpe/activities'
import { Loading } from '../../components/ui/Loading'

// Un tableau à la fois : le résumé du coach d'abord, le détail sur demande
const TABS = [
  { id: 'resume', label: 'Résumé coach' },
  { id: 'charge', label: 'Charge par joueur' },
  { id: 'rpe', label: 'RPE moyen' },
  { id: 'jours', label: 'Jour par jour' },
  { id: 'piliers', label: 'Répartition' },
] as const
type TabId = (typeof TABS)[number]['id']

const PILLAR_COLOR: Record<Pillar, string> = { rugby: BRAND.rnr, physique: BRAND.gold, accompagnement: BRAND.ok, ppid: BRAND.muted }
const STATUS_COLOR = { 'sous-charge': BRAND.gold, conforme: BRAND.ok, surcharge: BRAND.rnr } as const

export function WeekView() {
  const ref = useReference()
  const roster = useRoster()
  const [code, setCode] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('resume')
  const [exporting, setExporting] = useState<'pptx' | 'xlsx' | null>(null)
  const [exportFailed, setExportFailed] = useState(false)
  const weeks = ref.data?.weeks ?? []
  const week = weeks.find(w => w.code === code) ?? weekOf(weeks, parisDate())
  const logs = useAllLogs(week?.start_date ?? '', week ? weekEnd(week) : '')
  const plan = useAllPlan(week?.start_date ?? '', week ? weekEnd(week) : '')
  const targets = useTargetRpes()

  if (ref.isPending || roster.isPending || (week && logs.isPending)) return <Loading />
  if (ref.isError || roster.isError || logs.isError) return <p>Impossible de charger la semaine.</p>
  if (!week) return <p>Aucune semaine dans le calendrier : ajoute-les dans CONFIG_SEMAINES_PER puis relance l'import.</p>

  const wt = ref.data.weekTypes.find(t => t.code === week.week_type_code) ?? null
  const weekLogs = logs.data ?? []
  // Blessés : suivis dans l'onglet Médical, hors de la semaine du groupe (charge et RPE ne s'y appliquent plus)
  const players = roster.data.filter(p => !p.injured)
  const m = weekMatrix(players, weekLogs, week.start_date, wt, { inProgress: weekEnd(week) >= parisDate() })
  const types = ref.data.types
  // Seuils de charge (0030) : séances au-dessus du seuil de leur activité, et rythme de la semaine en cours selon le planning
  const alerts: Alerts = new Map(m.rows.map(r => [r.player.id, {
    hot: hotSessions(weekLogs.filter(l => l.player_id === r.player.id), types, l => sessionTarget(l, plan.data ?? [], week.week_type_code, targets.data ?? [])),
    pace: m.inProgress ? weekPace(r.player, r.total, plan.data ?? [], parisDate(), wt) : null,
  }]))
  // Export au clic ; module absent (hors ligne, ou onglet resté ouvert après une mise à jour) : message plutôt qu'un bouton muet
  const run = async (kind: 'pptx' | 'xlsx', task: () => Promise<void>) => {
    setExporting(kind)
    setExportFailed(false)
    try { await task() } catch { setExportFailed(true) } finally { setExporting(null) }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <ViewSelect label="Semaine" value={week.code} onChange={setCode}>
            {weeks.map(w => <option key={w.code} value={w.code}>{w.code} · {w.label}</option>)}
          </ViewSelect>
          <ViewSelect label="Afficher" value={tab} onChange={setTab}>
            {TABS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </ViewSelect>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" disabled={!!exporting} onClick={() => run('pptx', async () => {
            const [{ downloadWeekReport }, { weekReport }] = await Promise.all([import('./exportPptx'), import('./report')]) // pptxgenjs chargé au clic
            const inProgress = weekEnd(week) >= parisDate()
            await downloadWeekReport(weekReport({ week, wt, players, logs: weekLogs, inProgress }), week, wt, weekLogs, types, `PER_${week.code}_${week.start_date}.pptx`)
          })}>
            {exporting === 'pptx' ? 'Préparation…' : `Résumé ${week.code} (PowerPoint)`}
          </Button>
          <Button variant="ghost" size="sm" disabled={!!exporting} onClick={() => run('xlsx', () => downloadWeek(week, wt, players, weekLogs, types))}>
            {exporting === 'xlsx' ? 'Préparation…' : `Tableaux ${week.code} (Excel)`}
          </Button>
          {exportFailed && <p role="alert" className="w-full text-sm text-rnr">Création du fichier impossible : recharge la page et réessaie.</p>}
        </div>
      </div>


      <div className="flex flex-col gap-8">
      {tab === 'resume' && <CoachSummary m={m} wt={wt} code={week.code} pillars={pillarSplit(weekLogs, types, wt)} alerts={alerts}
        missing={plan.data ? missingRpe(players, plan.data, weekLogs, types, week.start_date, [weekEnd(week), addDays(parisDate(), -1)].sort()[0]) : null}
        gaps={l => rpeGap(l.rpe, sessionTarget(l, plan.data ?? [], week.week_type_code, targets.data ?? []).range)}
        rpeText={l => rpeVsTarget(l.rpe, sessionTarget(l, plan.data ?? [], week.week_type_code, targets.data ?? []).range)}
        logs={weekLogs} types={types} />}
      {tab === 'charge' && <LoadTable m={m} alerts={alerts} weekStart={week.start_date} />}
      {tab === 'rpe' && <RpeTable data={rpeMatrix(players, weekLogs, week.start_date)} logs={weekLogs} types={types} weekStart={week.start_date}
        target={l => sessionTarget(l, plan.data ?? [], week.week_type_code, targets.data ?? []).range} />}
      {tab === 'jours' && (
        <Card title="Synthèse collective jour par jour" help="Pour chaque jour : combien de joueurs ont déclaré, durée et charge moyennes. UA/min : intensité moyenne de la journée.">
          <SimpleTable header={['Jour', 'Déclarants', 'Durée moy. (min)', 'Rugby', 'Physique', 'sRPE moyen', 'sRPE cumulé', 'UA/min']}
            rows={dailySynthesis(weekLogs, types, week.start_date).filter(d => d.declarants > 0)
              .map(d => [d.day, d.declarants, d.avgMinutes, d.rugbyMinutes, d.physiqueMinutes, d.avgSrpe, d.cumulSrpe, d.intensity])} />
        </Card>
      )}
      {tab === 'piliers' && (
        <Card title="Répartition par pilier" help="Minutes moyennes par joueur dans chaque pilier, comparées à la répartition visée pour ce type de semaine.">
          <SimpleTable header={['Pilier', 'Réalisé (min)', '% réalisé', '% cible', 'Écart']}
            rows={pillarSplit(weekLogs, types, wt).map(p => [PILLAR_LABEL[p.pillar], p.minutes, pct(p.pct), pct(p.targetPct), pct(p.gap, true)])} />
        </Card>
      )}
      </div>
    </>
  )
}

// LE tableau du coach : charges vs cible, joueurs hors plage bien visibles, répartition de l'activité
type Alerts = Map<string, { hot: ReturnType<typeof hotSessions>; pace: ReturnType<typeof weekPace> }>
const HEAT_CELL: Record<Heat, string> = { warn: 'bg-gold/20 font-semibold', bad: 'bg-rnr/15 font-semibold' }
const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' })

function CoachSummary({ m, wt, code, pillars, alerts, missing, gaps, rpeText, logs, types }: {
  m: ReturnType<typeof weekMatrix>; wt: WeekType | null; code: string; pillars: ReturnType<typeof pillarSplit>; alerts: Alerts
  missing: ReturnType<typeof missingRpe> | null; gaps: (l: Log) => ReturnType<typeof rpeGap>; rpeText: (l: Log) => string; logs: Log[]; types: ActivityType[]
}) {
  const bars = [...m.rows].sort((a, b) => b.total - a.total).map(r => ({
    name: fullName(r.player), total: r.total,
    color: r.player.injured || !r.status ? BRAND.muted : STATUS_COLOR[r.status],
  }))
  const under = m.anomalies.filter(r => r.status === 'sous-charge')
  const over = m.anomalies.filter(r => r.status === 'surcharge')
  const name = (l: Log) => types.find(t => t.id === l.activity_type_id)?.name ?? '—'
  const worst = (heats: (Heat | null)[]): Heat => (heats.includes('bad') ? 'bad' : 'warn')
  // Un joueur par ligne, ses points d'attention en étiquettes ; le détail se déplie au clic (onglet Semaine allégé)
  const watch = m.rows.map(r => {
    const id = r.player.id, issues: Issue[] = []
    const miss = missing?.find(x => x.player.id === id)
    if (miss) issues.push({ label: `${miss.missed} RPE non déclaré${miss.missed > 1 ? 's' : ''}`, tone: miss.missed / miss.planned >= 0.25 ? 'bad' : 'warn',
      detail: miss.days.map(d => `${shortDay(d.date)} : ${d.missing.join(', ')}`) })
    const pace = alerts.get(id)?.pace
    if (pace?.over) issues.push({ label: `rythme ${pct(pace.pct ?? 0)}`, tone: 'bad', detail: [`${r.total} UA pour ${pace.limit} au rythme de la semaine (${pace.share} % du planning passé)`] })
    const hot = alerts.get(id)?.hot ?? []
    if (hot.length) issues.push({ label: `${hot.length} séance${hot.length > 1 ? 's' : ''} trop haute${hot.length > 1 ? 's' : ''}`, tone: worst(hot.map(h => h.heat)),
      detail: hot.map(h => `${shortDay(h.date)} ${h.name} : ${h.srpe} UA pour un seuil de ${h.max}`) })
    const off = logs.filter(l => l.player_id === id).map(l => ({ l, g: gaps(l) })).filter(x => x.g?.heat)
    if (off.length) issues.push({ label: `${off.length} RPE hors fourchette`, tone: worst(off.map(x => x.g!.heat)),
      detail: off.map(x => `${shortDay(x.l.session_date)} ${name(x.l)} : ${rpeText(x.l)}`) })
    // RPE de séance à exercices ≤ 2 : effort quasi nul, échelle sans doute mal comprise (étape 12c)
    const low = logs.filter(l => l.player_id === id && l.rpe !== null && Number(l.rpe) <= 2 && EXERCISE_SESSIONS.includes(name(l)))
    if (low.length) issues.push({ label: `RPE muscu très bas (${low.length})`, tone: 'warn',
      detail: [...low.map(l => `${shortDay(l.session_date)} ${name(l)} : RPE ${Number(l.rpe).toLocaleString('fr-FR')}`), 'Échelle de Borg mal comprise ? À vérifier avec le joueur.'] })
    if (r.status && r.status !== 'conforme' && !r.player.injured) issues.push({ label: r.status, tone: STATUS_TONE[r.status], detail: [`${r.total} UA, ${pct(r.pct)} de la charge visée`] })
    return { player: r.player, issues }
  }).filter(w => w.issues.length > 0)
    .sort((a, b) => b.issues.filter(i => i.tone === 'bad').length - a.issues.filter(i => i.tone === 'bad').length || b.issues.length - a.issues.length)
  const shownPillars = pillars.filter(p => p.pct > 0)

  const verdict = m.groupStatus ? { 'sous-charge': 'en sous-charge', conforme: 'dans la plage visée', surcharge: 'en surcharge' }[m.groupStatus] : null
  return (
    <>
      <p className="max-w-4xl text-lg leading-snug">
        {m.inProgress ? 'Semaine en cours : pour l\'instant, le' : 'Le'} groupe est à <strong>{m.groupMean.toLocaleString('fr-FR')} UA</strong> en moyenne
        {wt ? <>, soit <strong>{pct(m.groupPct)}</strong> de la charge visée en {code} ({wt.name.toLowerCase()}, {wt.target_srpe.toLocaleString('fr-FR')} UA)</> : ''}
        {verdict && <> — <strong className={STATUS_TONE[m.groupStatus!] === 'ok' ? 'text-ok' : STATUS_TONE[m.groupStatus!] === 'bad' ? 'text-rnr' : 'text-gold'}>{verdict}</strong></>}.
        {!m.inProgress && <> {under.length} joueur{under.length > 1 ? 's' : ''} en sous-charge, {over.length} en surcharge.</>}
      </p>
      <div className="flex flex-wrap gap-3">
        <Kpi label="Charge moyenne du groupe" value={`${m.groupMean} UA`} hint="Joueurs aptes" />
        <Kpi label={`Charge visée ${code}`} value={`${wt?.target_srpe ?? '—'} UA`} hint={wt ? `${wt.name} · plage ${rangeLabel(wt)}` : 'Hors calendrier'} />
        <Kpi label="% de la cible" value={pct(m.groupPct)} />
        <Kpi label="Statut du groupe" value={m.groupStatus ?? (m.inProgress ? 'semaine en cours' : 'hors calendrier')}
          tone={m.groupStatus ? STATUS_TONE[m.groupStatus] : 'neutral'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title="Charge de chaque joueur" help="Une barre par joueur, du plus chargé au moins chargé. Bande verte : plage visée · pointillés : charge visée. Vert conforme, jaune sous-charge, rouge surcharge, gris semaine en cours. Joueurs blessés : onglet Médical.">
            <div className="text-ink/60" style={{ height: Math.max(220, bars.length * 28) }}>
              <ResponsiveContainer>
                <BarChart data={bars} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeOpacity={0.15} horizontal={false} />
                  {wt && <ReferenceArea x1={wt.srpe_min ?? 0} x2={wt.srpe_max ?? undefined} fill={BRAND.ok} fillOpacity={0.08} />}
                  {/* l'axe va au moins jusqu'au haut de la plage : la cible et la bande verte restent visibles en début de semaine */}
                  <XAxis type="number" domain={[0, (max: number) => Math.ceil(Math.max(max, wt?.srpe_max ?? wt?.target_srpe ?? 0) / 500) * 500]} tickCount={6} tick={{ fill: 'currentColor', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fill: 'currentColor', fontSize: 12 }} />
                  <Tooltip formatter={v => [`${v} UA`, 'sRPE']} />
                  {wt && <ReferenceLine x={wt.target_srpe} stroke={BRAND.gold} strokeDasharray="4 4" label={{ value: 'visée', fill: 'currentColor', fontSize: 11, position: 'top' }} />}
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>{bars.map(b => <Cell key={b.name} fill={b.color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <WatchCard rows={watch} code={code} inProgress={m.inProgress} counts={{ under: under.length, over: over.length }} />

          <Card title="Répartition de l'activité" help="Part du temps passé dans chaque pilier ; la cible du type de semaine entre parenthèses.">
            {shownPillars.length === 0 ? <p className="text-sm text-ink/70">Aucune activité déclarée.</p> : (
              <div className="h-48">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={shownPillars} dataKey="pct" nameKey="pillar" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                      {shownPillars.map(p => <Cell key={p.pillar} fill={PILLAR_COLOR[p.pillar]} />)}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${v} %`, PILLAR_LABEL[String(name) as Pillar]]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <ul className="text-sm flex flex-col gap-1">
              {pillars.map(p => (
                <li key={p.pillar} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <svg aria-hidden="true" width="12" height="12"><circle cx="6" cy="6" r="6" fill={PILLAR_COLOR[p.pillar]} /></svg>
                    {PILLAR_LABEL[p.pillar]}
                  </span>
                  <span><strong>{pct(p.pct)}</strong> <span className="text-ink/60">(cible {pct(p.targetPct)})</span></span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}

type Issue = { label: string; tone: 'warn' | 'bad' | 'neutral'; detail: string[] }

// « À surveiller » : un joueur par ligne avec ses étiquettes (RPE non déclarés, rythme, séances trop hautes, RPE hors
// fourchette, sous / surcharge, blessé) ; un clic déplie le détail jour par jour
function WatchCard({ rows, code, inProgress, counts }: {
  rows: { player: MatrixRow['player']; issues: Issue[] }[]; code: string; inProgress: boolean; counts: { under: number; over: number }
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  // Deux niveaux : « En priorité » (au moins un point grave) puis « À garder à l'œil » ; 6 lignes d'abord, le reste à la demande
  const urgent = rows.filter(r => r.issues.some(i => i.tone === 'bad'))
  const shown = all ? rows : rows.slice(0, 6)
  const line = ({ player, issues }: (typeof rows)[number]) => {
    const expanded = open === player.id
    return (
      <li key={player.id} className="border-t border-line/60 first:border-0">
        <button type="button" onClick={() => setOpen(expanded ? null : player.id)} aria-expanded={expanded}
          className="flex w-full flex-wrap items-center gap-x-1.5 gap-y-1 py-2 text-left text-sm">
          <span className="mr-1 font-semibold">{fullName(player)}</span>
          {issues.map(i => <Badge key={i.label} tone={i.tone}>{i.label}</Badge>)}
          <span aria-hidden="true" className="ml-auto text-xs text-ink/50">{expanded ? 'Masquer' : 'Détails'}</span>
        </button>
        {expanded && (
          <div className="mb-2 flex flex-col gap-1.5 rounded-lg bg-field px-3 py-2 text-sm">
            {issues.map(i => (
              <div key={i.label}>
                <p className="font-semibold">{i.label}</p>
                <ul className="text-ink/75">{i.detail.map((d, k) => <li key={k}>{d}</li>)}</ul>
              </div>
            ))}
            <Link to={`/staff/joueur/${player.id}`} className="self-start text-gold hover:underline">Ouvrir sa fiche</Link>
          </div>
        )}
      </li>
    )
  }
  const group = (title: string, list: typeof rows) => list.length > 0 && (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">{title} · {list.length}</h3>
      <ul className="flex flex-col">{list.map(line)}</ul>
    </div>
  )
  return (
    <Card title={`À surveiller en ${code} · ${rows.length}`}
      help="Pastille rouge : à voir en priorité ; jaune : à garder à l'œil. « Détails » : le jour par jour.">
      {!rows.length ? <p className="text-sm text-ok">Rien à signaler cette semaine.</p> : (
        <div className="flex flex-col gap-3">
          {group('En priorité', shown.filter(r => urgent.includes(r)))}
          {group('À garder à l\'œil', shown.filter(r => !urgent.includes(r)))}
          <MoreButton hidden={rows.length - shown.length} open={all} onToggle={() => setAll(!all)} />
        </div>
      )}
      {inProgress ? <p className="text-xs text-ink/60">Semaine en cours : sous-charge et surcharge s'affichent une fois la semaine terminée.</p>
        : !counts.under && !counts.over && <p className="text-xs text-ink/60">Tous les joueurs aptes sont dans la plage de la semaine.</p>}
    </Card>
  )
}

function LoadTable({ m, alerts, weekStart }: { m: ReturnType<typeof weekMatrix>; alerts: Alerts; weekStart: string }) {
  return (
    <Card title="Charge par joueur" help="Charge (sRPE = RPE × minutes) jour par jour et sur la semaine. Case orange ou rouge : une séance du jour dépasse son seuil, haut de la fourchette de RPE visé × durée prévue (survol : le détail). % cible : total ÷ charge visée. Rythme (semaine en cours) : total ÷ charge visée au prorata du planning passé. vs groupe : écart à la moyenne des joueurs aptes.">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-ink/60">
            <tr>
              <th className="py-2 pr-3 font-normal">Joueur</th><th className="pr-3 font-normal">Séances</th>
              {DAY_NAMES.map(d => <th key={d} className="pr-3 font-normal text-right">{d.slice(0, 3)}</th>)}
              <th className="pr-3 font-normal text-right">Total</th><th className="pr-3 font-normal text-right">% cible</th>
              <th className="pr-3 font-normal text-right">Écart</th><th className="pr-3 font-normal text-right">vs groupe</th>
              {m.inProgress && <th className="pr-3 font-normal text-right">Rythme</th>}<th className="font-normal">Statut</th>
            </tr>
          </thead>
          <tbody>
            {m.rows.map(r => (
              <tr key={r.player.id} className="border-t border-line">
                <td className="py-2 pr-3"><Link to={`/staff/joueur/${r.player.id}`} className="font-semibold hover:underline">{fullName(r.player)}</Link></td>
                <td className="pr-3">{r.sessions}</td>
                {r.byDay.map((v, i) => {
                  const day = (alerts.get(r.player.id)?.hot ?? []).filter(h => h.date === addDays(weekStart, i))
                  const heat: Heat | null = day.some(h => h.heat === 'bad') ? 'bad' : day.length ? 'warn' : null
                  return (
                    <td key={i} className={`pr-3 text-right ${heat ? `${HEAT_CELL[heat]} rounded` : ''}`}
                      title={day.map(h => `${h.name} : ${h.srpe} UA (seuil ${h.max})`).join('\n') || undefined}>
                      {v || '—'}{heat && <span className="sr-only"> (au-dessus du seuil : {day.map(h => h.name).join(', ')})</span>}
                    </td>
                  )
                })}
                <td className="pr-3 text-right font-semibold">{r.total}</td>
                <td className="pr-3 text-right">{pct(r.pct)}</td>
                <td className="pr-3 text-right">{r.gap > 0 ? '+' : ''}{r.gap}</td>
                <td className="pr-3 text-right">{pct(r.vsGroupPct, true)}</td>
                {m.inProgress && (() => {
                  const p = alerts.get(r.player.id)?.pace
                  return <td className="pr-3 text-right" title={p ? `${r.total} UA pour ${p.limit} au rythme (${p.share} % du planning passé)` : 'Pas de type de semaine ou pas de planning'}>
                    {!p ? '—' : p.over ? <Badge tone="bad">{pct(p.pct ?? 0)}</Badge> : pct(p.pct ?? 0)}
                  </td>
                })()}
                <td>{r.player.injured ? <Badge tone="neutral">blessé</Badge> : r.status ? <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> : m.inProgress ? <Badge tone="neutral">en cours</Badge> : '—'}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-line font-semibold">
              <td className="py-2 pr-3">Moyenne du groupe (aptes)</td><td />
              {m.dayMeans.map((v, i) => <td key={i} className="pr-3 text-right">{v || '—'}</td>)}
              <td className="pr-3 text-right">{m.groupMean}</td><td className="pr-3 text-right">{pct(m.groupPct)}</td><td colSpan={m.inProgress ? 4 : 3} />
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}

const rpeTone = (v: number | null) => (v === null ? null : v >= 8 ? 'bad' : v >= 6 ? 'warn' : 'ok')

// Détail au clic : chaque activité du jour (ou de la semaine) avec le RPE déclaré, le RPE visé et l'écart (±2 orange, ±3 rouge)
function RpeDetail({ logs, types, target }: { logs: Log[]; types: ActivityType[]; target: (l: Log) => RpeRange | null }) {
  const rated = logs.filter(l => l.rpe !== null).sort((a, b) => a.session_date.localeCompare(b.session_date))
  if (!rated.length) return <p className="text-sm text-ink/60">Aucune activité avec RPE.</p>
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {rated.map((l, i) => {
        const t = target(l), g = rpeGap(l.rpe, t)
        return (
          <li key={i} className="flex items-center gap-2">
            <span className="text-ink/60">{shortDay(l.session_date)}</span>
            <span className="font-semibold">{types.find(x => x.id === l.activity_type_id)?.name ?? '—'}</span>
            {g?.heat ? <Badge tone={g.heat}>{rpeVsTarget(l.rpe, t)}</Badge> : <span className="tabular-nums">{rpeVsTarget(l.rpe, t)}</span>}
          </li>
        )
      })}
    </ul>
  )
}

function RpeTable({ data, logs, types, weekStart, target }: {
  data: ReturnType<typeof rpeMatrix>; logs: Log[]; types: ActivityType[]; weekStart: string; target: (l: Log) => RpeRange | null
}) {
  const [open, setOpen] = useState<{ player: string; day: number | 'semaine' } | null>(null)
  const cell = (v: number | null): ReactNode => { const t = rpeTone(v); return t ? <Badge tone={t}>{v}</Badge> : '—' }
  const toggle = (player: string, day: number | 'semaine') => setOpen(o => (o?.player === player && o.day === day ? null : { player, day }))
  // Une activité loin du RPE visé ce jour-là : la case est soulignée (orange à ±2, rouge à ±3)
  const gapHeat = (player: string, date: string | null): Heat | null => {
    const heats = logs.filter(l => l.player_id === player && (date === null || l.session_date === date)).map(l => rpeGap(l.rpe, target(l))?.heat)
    return heats.includes('bad') ? 'bad' : heats.includes('warn') ? 'warn' : null
  }
  const RING: Record<Heat, string> = { warn: 'ring-2 ring-gold', bad: 'ring-2 ring-rnr' }
  return (
    <Card title="RPE moyen" help="Effort ressenti moyen (échelle de Borg 1 à 10) des activités avec RPE. Vert sous 6, jaune de 6 à 7,9, rouge à partir de 8. Clique sur un RPE pour voir chaque activité avec son RPE visé ; case entourée : au moins une activité à ±2 du RPE visé (orange) ou ±3 (rouge).">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-ink/60">
            <tr><th className="py-2 pr-3 font-normal">Joueur</th>{DAY_NAMES.map(d => <th key={d} className="pr-3 font-normal">{d.slice(0, 3)}</th>)}<th className="font-normal">Semaine</th></tr>
          </thead>
          <tbody>
            {[...data.rows].sort((a, b) => (b.week ?? -1) - (a.week ?? -1)).map(r => {
              const id = r.player.id
              const button = (v: number | null, day: number | 'semaine') => {
                if (v === null) return '—'
                const heat = gapHeat(id, day === 'semaine' ? null : addDays(weekStart, day))
                const selected = open?.player === id && open.day === day
                return (
                  <button type="button" onClick={() => toggle(id, day)} aria-expanded={selected}
                    aria-label={`${fullName(r.player)}, ${day === 'semaine' ? 'semaine' : DAY_NAMES[day]} : RPE ${v}, voir le détail`}
                    className={`rounded ${heat ? RING[heat] : ''} ${selected ? 'outline outline-1 outline-ink/40' : ''}`}>{cell(v)}</button>
                )
              }
              return (
                <Fragment key={id}>
                  <tr className="border-t border-line">
                    <td className="py-2 pr-3"><Link to={`/staff/joueur/${id}`} className="font-semibold hover:underline">{fullName(r.player)}</Link></td>
                    {r.byDay.map((v, i) => <td key={i} className="pr-3">{button(v, i)}</td>)}
                    <td className="font-semibold">{button(r.week, 'semaine')}</td>
                  </tr>
                  {open?.player === id && (
                    <tr><td colSpan={9} className="bg-field/60 px-3 py-2">
                      <RpeDetail logs={logs.filter(l => l.player_id === id && (open.day === 'semaine' || l.session_date === addDays(weekStart, open.day)))} types={types} target={target} />
                    </td></tr>
                  )}
                </Fragment>
              )
            })}
            <tr className="border-t-2 border-line font-semibold">
              <td className="py-2 pr-3">Moyenne du groupe (aptes)</td>
              {data.groupByDay.map((v, i) => <td key={i} className="pr-3">{v ?? '—'}</td>)}<td>{data.groupWeek ?? '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function SimpleTable({ header, rows }: { header: (string | number)[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-ink/60"><tr>{header.map(h => <th key={String(h)} className="py-1 pr-3 font-normal">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className="py-1.5 pr-3">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

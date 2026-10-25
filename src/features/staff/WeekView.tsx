import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Kpi } from '../../components/ui/Kpi'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { BRAND } from '../../lib/brand'
import { parisDate } from '../../lib/week'
import { pct } from '../../lib/format'
import { PILLAR_LABEL, downloadWeek, weekEnd } from './exportWeek'
import {
  DAY_NAMES, STATUS_TONE, dailySynthesis, fullName, pillarSplit, rangeLabel, rpeMatrix, weekMatrix, weekOf,
  type MatrixRow, type Pillar, type WeekType,
} from './load'
import { useAllLogs, useReference, useRoster } from './useStaff'
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
  const [exporting, setExporting] = useState(false)
  const weeks = ref.data?.weeks ?? []
  const week = weeks.find(w => w.code === code) ?? weekOf(weeks, parisDate())
  const logs = useAllLogs(week?.start_date ?? '', week ? weekEnd(week) : '')

  if (ref.isPending || roster.isPending || (week && logs.isPending)) return <Loading />
  if (ref.isError || roster.isError || logs.isError) return <p>Impossible de charger la semaine.</p>
  if (!week) return <p>Aucune semaine dans le calendrier : ajoute-les dans CONFIG_SEMAINES_PER puis relance l'import.</p>

  const wt = ref.data.weekTypes.find(t => t.code === week.week_type_code) ?? null
  const weekLogs = logs.data ?? []
  const m = weekMatrix(roster.data, weekLogs, week.start_date, wt, { inProgress: weekEnd(week) >= parisDate() })
  const types = ref.data.types

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
          <Button variant="ghost" size="sm" disabled={exporting} onClick={async () => {
            setExporting(true)
            try {
              const [{ downloadWeekReport }, { weekReport }] = await Promise.all([import('./exportPptx'), import('./report')]) // pptxgenjs chargé au clic
              const inProgress = weekEnd(week) >= parisDate()
              await downloadWeekReport(weekReport({ week, wt, players: roster.data, logs: weekLogs, inProgress }), week, wt, weekLogs, types, `PER_${week.code}_${week.start_date}.pptx`)
            } finally { setExporting(false) }
          }}>
            {exporting ? 'Préparation…' : `Résumé ${week.code} (PowerPoint)`}
          </Button>
          <Button variant="ghost" size="sm" disabled={exporting} onClick={async () => {
            setExporting(true)
            try { await downloadWeek(week, wt, roster.data, weekLogs, types) } finally { setExporting(false) }
          }}>
            {exporting ? 'Préparation…' : `Tableaux ${week.code} (Excel)`}
          </Button>
        </div>
      </div>


      <div className="flex flex-col gap-8">
      {tab === 'resume' && <CoachSummary m={m} wt={wt} code={week.code} pillars={pillarSplit(weekLogs, types, wt)} />}
      {tab === 'charge' && <LoadTable m={m} />}
      {tab === 'rpe' && <RpeTable data={rpeMatrix(roster.data, weekLogs, week.start_date)} />}
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
function CoachSummary({ m, wt, code, pillars }: { m: ReturnType<typeof weekMatrix>; wt: WeekType | null; code: string; pillars: ReturnType<typeof pillarSplit> }) {
  const bars = [...m.rows].sort((a, b) => b.total - a.total).map(r => ({
    name: fullName(r.player), total: r.total,
    color: r.player.injured || !r.status ? BRAND.muted : STATUS_COLOR[r.status],
  }))
  const under = m.anomalies.filter(r => r.status === 'sous-charge')
  const over = m.anomalies.filter(r => r.status === 'surcharge')
  const injured = m.rows.filter(r => r.player.injured)
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
          <Card title="Charge de chaque joueur" help="Une barre par joueur, du plus chargé au moins chargé. Bande verte : plage visée · pointillés : charge visée. Vert conforme, jaune sous-charge, rouge surcharge, gris blessé ou semaine en cours.">
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
          <Card title="Joueurs hors plage" help="Joueurs aptes dont la charge de la semaine sort de la plage visée. Un nom ouvre sa fiche.">
            {m.inProgress && <p className="text-sm text-ink/70">Semaine en cours : la liste se remplit une fois la semaine terminée.</p>}
            <Group title={`En sous-charge (${under.length})`} rows={under} tone="warn" />
            <Group title={`En surcharge (${over.length})`} rows={over} tone="bad" />
            {injured.length > 0 && <Group title={`Blessés, hors alertes (${injured.length})`} rows={injured} tone="neutral" />}
            {!m.inProgress && !under.length && !over.length && <p className="text-sm text-ok">Tous les joueurs aptes sont dans la plage.</p>}
          </Card>

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

function Group({ title, rows, tone }: { title: string; rows: MatrixRow[]; tone: 'warn' | 'bad' | 'neutral' }) {
  if (!rows.length) return null
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {rows.map(r => (
          <li key={r.player.id}>
            <Link to={`/staff/joueur/${r.player.id}`} className="hover:underline">
              <Badge tone={tone}>{fullName(r.player)} · {r.total} UA · {pct(r.pct)}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LoadTable({ m }: { m: ReturnType<typeof weekMatrix> }) {
  return (
    <Card title="Charge par joueur" help="Charge (sRPE = RPE × minutes) jour par jour et sur la semaine. % cible : total ÷ charge visée. vs groupe : écart à la moyenne des joueurs aptes.">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-ink/60">
            <tr>
              <th className="py-2 pr-3 font-normal">Joueur</th><th className="pr-3 font-normal">Séances</th>
              {DAY_NAMES.map(d => <th key={d} className="pr-3 font-normal text-right">{d.slice(0, 3)}</th>)}
              <th className="pr-3 font-normal text-right">Total</th><th className="pr-3 font-normal text-right">% cible</th>
              <th className="pr-3 font-normal text-right">Écart</th><th className="pr-3 font-normal text-right">vs groupe</th><th className="font-normal">Statut</th>
            </tr>
          </thead>
          <tbody>
            {m.rows.map(r => (
              <tr key={r.player.id} className="border-t border-line">
                <td className="py-2 pr-3"><Link to={`/staff/joueur/${r.player.id}`} className="font-semibold hover:underline">{fullName(r.player)}</Link></td>
                <td className="pr-3">{r.sessions}</td>
                {r.byDay.map((v, i) => <td key={i} className="pr-3 text-right">{v || '—'}</td>)}
                <td className="pr-3 text-right font-semibold">{r.total}</td>
                <td className="pr-3 text-right">{pct(r.pct)}</td>
                <td className="pr-3 text-right">{r.gap > 0 ? '+' : ''}{r.gap}</td>
                <td className="pr-3 text-right">{pct(r.vsGroupPct, true)}</td>
                <td>{r.player.injured ? <Badge tone="neutral">blessé</Badge> : r.status ? <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> : m.inProgress ? <Badge tone="neutral">en cours</Badge> : '—'}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-line font-semibold">
              <td className="py-2 pr-3">Moyenne du groupe (aptes)</td><td />
              {m.dayMeans.map((v, i) => <td key={i} className="pr-3 text-right">{v || '—'}</td>)}
              <td className="pr-3 text-right">{m.groupMean}</td><td className="pr-3 text-right">{pct(m.groupPct)}</td><td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}

const rpeTone = (v: number | null) => (v === null ? null : v >= 8 ? 'bad' : v >= 6 ? 'warn' : 'ok')

function RpeTable({ data }: { data: ReturnType<typeof rpeMatrix> }) {
  const cell = (v: number | null): ReactNode => { const t = rpeTone(v); return t ? <Badge tone={t}>{v}</Badge> : '—' }
  return (
    <Card title="RPE moyen" help="Effort ressenti moyen (échelle de Borg 1 à 10) des activités avec RPE. Vert sous 6, jaune de 6 à 7,9, rouge à partir de 8.">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-ink/60">
            <tr><th className="py-2 pr-3 font-normal">Joueur</th>{DAY_NAMES.map(d => <th key={d} className="pr-3 font-normal">{d.slice(0, 3)}</th>)}<th className="font-normal">Semaine</th></tr>
          </thead>
          <tbody>
            {[...data.rows].sort((a, b) => (b.week ?? -1) - (a.week ?? -1)).map(r => (
              <tr key={r.player.id} className="border-t border-line">
                <td className="py-2 pr-3"><Link to={`/staff/joueur/${r.player.id}`} className="font-semibold hover:underline">{fullName(r.player)}</Link></td>
                {r.byDay.map((v, i) => <td key={i} className="pr-3">{cell(v)}</td>)}
                <td className="font-semibold">{cell(r.week)}</td>
              </tr>
            ))}
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

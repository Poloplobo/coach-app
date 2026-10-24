import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Kpi } from '../../components/ui/Kpi'
import { BRAND } from '../../lib/brand'
import { parisDate } from '../../lib/week'
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Semaine
          <select value={week.code} onChange={e => setCode(e.target.value)} className="rounded-lg bg-surface border border-line px-3 py-2">
            {weeks.map(w => <option key={w.code} value={w.code}>{w.code} · {w.label} · {w.start_date}</option>)}
          </select>
        </label>
        <Button disabled={exporting} onClick={async () => {
          setExporting(true)
          try { await downloadWeek(week, wt, roster.data, weekLogs, types) } finally { setExporting(false) }
        }}>
          {exporting ? 'Préparation…' : `Télécharger ${week.code} (Excel)`}
        </Button>
      </div>

      <div role="tablist" aria-label="Vues de la semaine" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map(t => (
          <button key={t.id} id={`tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} aria-controls="week-panel" onClick={() => setTab(t.id)}
            className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.id ? 'border-rnr text-ink' : 'border-transparent text-ink/60'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div id="week-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-4">
      {tab === 'resume' && <CoachSummary m={m} wt={wt} code={week.code} pillars={pillarSplit(weekLogs, types, wt)} />}
      {tab === 'charge' && <LoadTable m={m} />}
      {tab === 'rpe' && <RpeTable data={rpeMatrix(roster.data, weekLogs, week.start_date)} />}
      {tab === 'jours' && (
        <Card title="Synthèse collective jour par jour">
          <SimpleTable header={['Jour', 'Déclarants', 'Durée moy. (min)', 'Rugby', 'Physique', 'sRPE moyen', 'sRPE cumulé', 'UA/min']}
            rows={dailySynthesis(weekLogs, types, week.start_date).filter(d => d.declarants > 0)
              .map(d => [d.day, d.declarants, d.avgMinutes, d.rugbyMinutes, d.physiqueMinutes, d.avgSrpe, d.cumulSrpe, d.intensity])} />
        </Card>
      )}
      {tab === 'piliers' && (
        <Card title="Répartition par pilier (minutes moyennes par joueur)">
          <SimpleTable header={['Pilier', 'Réalisé (min)', '% réalisé', '% cible', 'Écart']}
            rows={pillarSplit(weekLogs, types, wt).map(p => [PILLAR_LABEL[p.pillar], p.minutes, `${p.pct} %`, `${p.targetPct} %`, `${p.gap > 0 ? '+' : ''}${p.gap} %`])} />
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

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Kpi label="Charge moyenne du groupe" value={`${m.groupMean} UA`} hint="Joueurs aptes" />
        <Kpi label={`Charge visée ${code}`} value={`${wt?.target_srpe ?? '—'} UA`} hint={wt ? `${wt.name} · plage ${rangeLabel(wt)}` : 'Hors calendrier'} />
        <Kpi label="% de la cible" value={`${m.groupPct} %`} />
        <Kpi label="Statut du groupe" value={m.groupStatus ?? (m.inProgress ? 'semaine en cours' : 'hors calendrier')}
          tone={m.groupStatus ? STATUS_TONE[m.groupStatus] : 'neutral'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title="Charge de chaque joueur vs charge visée">
            <div className="text-ink/60" style={{ height: Math.max(220, bars.length * 28) }}>
              <ResponsiveContainer>
                <BarChart data={bars} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeOpacity={0.15} horizontal={false} />
                  {wt && <ReferenceArea x1={wt.srpe_min ?? 0} x2={wt.srpe_max ?? undefined} fill={BRAND.ok} fillOpacity={0.08} />}
                  <XAxis type="number" tick={{ fill: 'currentColor', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fill: 'currentColor', fontSize: 12 }} />
                  <Tooltip formatter={v => [`${v} UA`, 'sRPE']} />
                  {wt && <ReferenceLine x={wt.target_srpe} stroke={BRAND.gold} strokeDasharray="4 4" label={{ value: 'visée', fill: 'currentColor', fontSize: 11, position: 'top' }} />}
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>{bars.map(b => <Cell key={b.name} fill={b.color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-ink/60">Bande verte : plage conforme. Vert conforme · jaune sous-charge · rouge surcharge · gris blessé ou semaine en cours.</p>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card title="Joueurs hors plage">
            {m.inProgress && <p className="text-sm text-ink/70">Semaine en cours : la liste se remplit une fois la semaine terminée.</p>}
            <Group title={`En sous-charge (${under.length})`} rows={under} tone="warn" />
            <Group title={`En surcharge (${over.length})`} rows={over} tone="bad" />
            {injured.length > 0 && <Group title={`Blessés, hors alertes (${injured.length})`} rows={injured} tone="neutral" />}
            {!m.inProgress && !under.length && !over.length && <p className="text-sm text-ok">Tous les joueurs aptes sont dans la plage.</p>}
          </Card>

          <Card title="Répartition de l'activité">
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
                  <span><strong>{p.pct} %</strong> <span className="text-ink/60">(cible {p.targetPct} %)</span></span>
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
              <Badge tone={tone}>{fullName(r.player)} · {r.total} UA · {r.pct} %</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LoadTable({ m }: { m: ReturnType<typeof weekMatrix> }) {
  return (
    <Card title="Charge par joueur (sRPE)">
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
                <td className="pr-3 text-right">{r.pct} %</td>
                <td className="pr-3 text-right">{r.gap > 0 ? '+' : ''}{r.gap}</td>
                <td className="pr-3 text-right">{r.vsGroupPct > 0 ? '+' : ''}{r.vsGroupPct} %</td>
                <td>{r.player.injured ? <Badge tone="neutral">blessé</Badge> : r.status ? <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> : m.inProgress ? <Badge tone="neutral">en cours</Badge> : '—'}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-line font-semibold">
              <td className="py-2 pr-3">Moyenne du groupe (aptes)</td><td />
              {m.dayMeans.map((v, i) => <td key={i} className="pr-3 text-right">{v || '—'}</td>)}
              <td className="pr-3 text-right">{m.groupMean}</td><td className="pr-3 text-right">{m.groupPct} %</td><td colSpan={3} />
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
    <Card title="RPE moyen de la semaine (activités avec RPE)">
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
      <p className="text-xs text-ink/60">Vert &lt; 6 · jaune 6 à 7,9 · rouge ≥ 8 (échelle CR-10).</p>
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

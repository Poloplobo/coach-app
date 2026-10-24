import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Kpi } from '../../components/ui/Kpi'
import { parisDate } from '../../lib/week'
import { PILLAR_LABEL, downloadWeek, weekEnd } from './exportWeek'
import { DAY_NAMES, STATUS_TONE, dailySynthesis, fullName, pillarSplit, rangeLabel, weekMatrix, weekOf } from './load'
import { useAllLogs, useReference, useRoster } from './useStaff'

export function WeekView() {
  const ref = useReference()
  const roster = useRoster()
  const [code, setCode] = useState<string | null>(null)
  const weeks = ref.data?.weeks ?? []
  const week = weeks.find(w => w.code === code) ?? weekOf(weeks, parisDate())
  const logs = useAllLogs(week?.start_date ?? '', week ? weekEnd(week) : '')
  const [exporting, setExporting] = useState(false)

  if (ref.isPending || roster.isPending || (week && logs.isPending)) return <p className="text-ink/60">Chargement…</p>
  if (ref.isError || roster.isError || logs.isError) return <p>Impossible de charger la semaine.</p>
  if (!week) return <p>Aucune semaine dans le calendrier : ajoute-les dans CONFIG_SEMAINES_PER puis relance l'import.</p>

  const wt = ref.data.weekTypes.find(t => t.code === week.week_type_code) ?? null
  const weekLogs = logs.data ?? []
  const m = weekMatrix(roster.data, weekLogs, week.start_date, wt, { inProgress: weekEnd(week) >= parisDate() })
  const synthesis = dailySynthesis(weekLogs, ref.data.types, week.start_date).filter(d => d.declarants > 0)
  const pillars = pillarSplit(weekLogs, ref.data.types, wt)

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
          try { await downloadWeek(week, wt, roster.data, weekLogs, ref.data.types) } finally { setExporting(false) }
        }}>
          {exporting ? 'Préparation…' : `Télécharger ${week.code} (Excel)`}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Kpi label="Charge obtenue (moyenne)" value={`${m.groupMean} UA`} hint="Joueurs aptes" />
        <Kpi label={`Charge visée ${week.code}`} value={`${wt?.target_srpe ?? '—'} UA`} hint={wt ? `${wt.name} · plage ${rangeLabel(wt)}` : 'Hors calendrier'} />
        <Kpi label="% de la cible (Accurate RPE)" value={`${m.groupPct} %`} />
        <Kpi label="Statut charge collective" value={m.groupStatus ?? (m.inProgress ? 'semaine en cours' : 'hors calendrier')} tone={m.groupStatus ? STATUS_TONE[m.groupStatus] : 'neutral'} />
      </div>

      <Card title="Matrice individuelle">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Synthèse collective quotidienne">
          <SimpleTable header={['Jour', 'Déclarants', 'Durée moy. (min)', 'Rugby', 'Physique', 'sRPE moyen', 'sRPE cumulé', 'UA/min']}
            rows={synthesis.map(d => [d.day, d.declarants, d.avgMinutes, d.rugbyMinutes, d.physiqueMinutes, d.avgSrpe, d.cumulSrpe, d.intensity])} />
        </Card>
        <Card title="Répartition par pilier (minutes moyennes par joueur)">
          <SimpleTable header={['Pilier', 'Réalisé (min)', '% réalisé', '% cible', 'Écart']}
            rows={pillars.map(p => [PILLAR_LABEL[p.pillar], p.minutes, `${p.pct} %`, `${p.targetPct} %`, `${p.gap > 0 ? '+' : ''}${p.gap} %`])} />
        </Card>
      </div>

      <Card title={`Anomalies de charge (${m.anomalies.length})`}>
        {m.anomalies.length === 0 ? <p className="text-sm text-ink/70">{m.inProgress ? 'Semaine en cours : les anomalies apparaissent une fois la semaine terminée.' : 'Aucun joueur apte hors de la plage.'}</p> : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {m.anomalies.map(r => (
              <li key={r.player.id}>
                <Link to={`/staff/joueur/${r.player.id}`} className="hover:underline">{fullName(r.player)}</Link>{' '}
                {r.status && <Badge tone={STATUS_TONE[r.status]}>{r.status} · {r.pct} %</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
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

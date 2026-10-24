import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Kpi } from '../../components/ui/Kpi'
import { addDays, parisDate } from '../../lib/week'
import { FatigueBody } from '../wellness/FatigueBody'
import { fatiguePercent } from '../wellness/fatigue'
import { WELLNESS_ITEMS } from '../wellness/items'
import { fullName, itemValue, latecomers, reminderMessage, wellnessAlerts } from './load'
import { useAllLogs, useAllPlan, useAllWellness, useRoster } from './useStaff'
import { Loading } from '../../components/ui/Loading'

const itemTone = (v: number | null) => (v === null ? 'neutral' : v >= 4 ? 'ok' : v === 3 ? 'warn' : 'bad')

export function TodayView() {
  const today = parisDate()
  const yesterday = addDays(today, -1)
  const roster = useRoster()
  const wellness = useAllWellness(today, today)
  const logs = useAllLogs(yesterday, today)
  const plan = useAllPlan(yesterday, yesterday)

  if (roster.isPending || wellness.isPending || logs.isPending || plan.isPending) return <Loading />
  if (roster.isError || wellness.isError || logs.isError || plan.isError) return <p>Impossible de charger les données du jour.</p>

  const byPlayer = new Map(wellness.data.map(w => [w.player_id, w]))
  const rows = roster.data.map(p => {
    const w = byPlayer.get(p.id)
    return { player: p, w, alerts: w ? wellnessAlerts(w) : [] }
  })
  // Alertes d'abord, puis forme non remplie, puis les autres par fatigue décroissante
  const rank = (r: (typeof rows)[number]) => (r.alerts.length ? 0 : !r.w ? 1 : 2)
  rows.sort((a, b) => rank(a) - rank(b) || (a.w?.score ?? 99) - (b.w?.score ?? 99))
  const filled = rows.filter(r => r.w).length
  const late = latecomers(roster.data, wellness.data, plan.data, logs.data, today)

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Kpi label="États de forme remplis" value={`${filled} / ${rows.length}`} />
        <Kpi label="Alertes" value={String(rows.filter(r => r.alerts.length).length)} tone={rows.some(r => r.alerts.length) ? 'bad' : 'ok'} />
        <Kpi label="Blessés" value={String(roster.data.filter(p => p.injured).length)} />
      </div>

      <Card title="État de forme du jour">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink/60">
              <tr>
                <th className="py-2 pr-3 font-normal">Joueur</th>
                <th className="pr-3 font-normal">Silhouette</th>
                <th className="pr-3 font-normal">Score</th>
                {WELLNESS_ITEMS.map(i => <th key={i.key} className="pr-2 font-normal">{i.label.replace('Courbatures ', 'Courb. ')}</th>)}
                <th className="font-normal">Alertes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ player, w, alerts }) => (
                <tr key={player.id} className="border-t border-line align-middle">
                  <td className="py-2 pr-3">
                    <Link to={`/staff/joueur/${player.id}`} className="font-semibold hover:underline">{fullName(player)}</Link>
                    <span className="block text-xs text-ink/60">{player.position}{player.injured && ' · '}{player.injured && <Badge tone="warn">blessé</Badge>}</span>
                  </td>
                  <td className="pr-3">
                    {w && w.score !== null ? <FatigueBody wellness={w} score={w.score} compact /> : <Badge tone="neutral">non rempli</Badge>}
                  </td>
                  <td className="pr-3 font-semibold">{w?.score != null ? `${w.score}/30` : '—'}</td>
                  {WELLNESS_ITEMS.map(i => {
                    const v = w ? itemValue(w, i.key) : null
                    return <td key={i.key} className="pr-2">{v !== null ? <Badge tone={itemTone(v)}>{v}</Badge> : '—'}</td>
                  })}
                  <td>{alerts.map(a => <span key={a} className="mr-1"><Badge tone="bad">{a}</Badge></span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {groupFatigue(rows) && <p className="text-xs text-ink/60">Fatigue estimée : {groupFatigue(rows)}.</p>}
      </Card>

      <Card title={`À relancer (${late.length})`}>
        {late.length === 0 && <p className="text-sm text-ink/70">Tout le monde est à jour.</p>}
        <ul className="flex flex-col gap-2">
          {late.map(({ player, missing }) => <Reminder key={player.id} name={fullName(player)} missing={missing} message={reminderMessage(player, missing)} />)}
        </ul>
      </Card>
    </>
  )
}

// Moyenne de fatigue estimée du groupe, pour situer chaque joueur
function groupFatigue(rows: { w?: { score: number | null } }[]) {
  const scores = rows.flatMap(r => (r.w?.score != null ? [r.w.score] : []))
  return scores.length ? `${Math.round(scores.reduce((s, v) => s + fatiguePercent(v), 0) / scores.length)} % en moyenne` : null
}

function Reminder({ name, missing, message }: { name: string; missing: string[]; message: string }) {
  const [copied, setCopied] = useState<boolean | null>(null)
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setCopied(true) } catch { setCopied(false) }
    setTimeout(() => setCopied(null), 2500)
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
      <span><span className="font-semibold">{name}</span> <span className="text-sm text-ink/70">— {missing.join(', ')}</span></span>
      <button type="button" onClick={copy} className="rounded-lg border border-line px-3 py-1.5 text-sm">
        {copied === null ? 'Copier le message' : copied ? 'Message copié' : 'Copie impossible'}
      </button>
    </li>
  )
}

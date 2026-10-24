import { Card } from '../../components/ui/Card'
import { addDays, formatDay, isoWeekStart } from '../../lib/week'
import { useWellnessRange } from '../wellness/useWellness'
import { fatiguePercent } from '../wellness/fatigue'
import { useLogsRange } from '../rpe/useRpe'
import { Loading } from '../../components/ui/Loading'

// Charge de la semaine (lundi → aujourd'hui) et historique des 7 derniers jours
export function MyWeek({ playerId, date }: { playerId: string; date: string }) {
  const from = [isoWeekStart(date), addDays(date, -6)].sort()[0]
  const logs = useLogsRange(playerId, from, date)
  const wellness = useWellnessRange(playerId, from, date)

  if (logs.isPending || wellness.isPending) return <Card title="Ma semaine"><Loading /></Card>
  if (logs.isError || wellness.isError) return <Card title="Ma semaine"><p>Impossible de charger ta semaine.</p></Card>

  const week = logs.data.filter(l => l.session_date >= isoWeekStart(date))
  const load = week.reduce((sum, l) => sum + Number(l.srpe ?? 0), 0)
  const minutes = week.reduce((sum, l) => sum + l.duration_min, 0)
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, -i))

  return (
    <Card title="Ma semaine" aside={<span className="text-sm text-ink/60 tabular-nums">{load} UA · {minutes} min</span>}>

      <table className="w-full text-sm">
        <thead className="text-ink/60">
          <tr><th className="text-left font-normal">7 derniers jours</th><th className="font-normal">Fatigue</th><th className="text-right font-normal">Charge</th></tr>
        </thead>
        <tbody>
          {days.map(d => {
            const dayLoad = logs.data.filter(l => l.session_date === d).reduce((s, l) => s + Number(l.srpe ?? 0), 0)
            const score = wellness.data.find(w => w.entry_date === d)?.score
            return (
              <tr key={d} className="border-t border-line">
                <td className="py-2 first-letter:uppercase">{formatDay(d)}</td>
                <td className="text-center">{score != null ? `${fatiguePercent(score)} %` : '—'}</td>
                <td className="text-right">{dayLoad ? `${dayLoad} UA` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

import type { ReactNode } from 'react'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { addDays, formatDay, isoWeekStart } from '../../lib/week'
import { upcomingByDay } from '../rpe/activities'
import { useAvailability, useLogsRange, usePlanRange } from '../rpe/useRpe'
import { fatiguePercent, postureOf } from '../wellness/fatigue'
import { useWellnessRange } from '../wellness/useWellness'

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DOT = ['bg-ok', 'bg-gold', 'bg-rnr'] // fatigue faible, moyenne, à surveiller

// La semaine en un coup d'œil : une barre de charge et un point de fatigue par jour (lundi → dimanche)
export function MyWeek({ playerId, date, footer }: { playerId: string; date: string; footer?: ReactNode }) {
  const start = isoWeekStart(date)
  const from = [start, addDays(date, -6)].sort()[0] // même plage que le tableau d'affichage : servie par le cache
  const logs = useLogsRange(playerId, from, date)
  const wellness = useWellnessRange(playerId, addDays(start, -7), date) // + semaine dernière : tendance de la fatigue
  const plan = usePlanRange(playerId, start, date)
  const availability = useAvailability(playerId)

  if (logs.isPending || wellness.isPending || plan.isPending || availability.isPending) return <Card title="Ma semaine"><Loading /></Card>
  if (logs.isError || wellness.isError || plan.isError || availability.isError) return <Card title="Ma semaine"><p>Impossible de charger ta semaine.</p></Card>

  // Résumé chiffré : activités déclarées / prévues depuis lundi, fatigue moyenne comparée à la semaine dernière
  const planned = upcomingByDay(plan.data, { injured: availability.data === 'blessé' }).reduce((n, d) => n + d.activities.length, 0)
  const declared = logs.data.filter(l => l.session_date >= start).length
  const meanFatigue = (from: string, to: string) => {
    const v = wellness.data.filter(w => w.entry_date >= from && w.entry_date <= to && w.score !== null).map(w => fatiguePercent(w.score!))
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
  }
  const fatigue = meanFatigue(start, date), before = meanFatigue(addDays(start, -7), addDays(start, -1))
  const trend = fatigue === null || before === null ? null : fatigue - before > 3 ? 'en hausse' : fatigue - before < -3 ? 'en baisse' : 'stable'

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i)
    const dayLogs = logs.data.filter(l => l.session_date === d)
    const score = wellness.data.find(w => w.entry_date === d)?.score
    return { d, load: dayLogs.reduce((s, l) => s + Number(l.srpe ?? 0), 0), fatigue: score != null ? fatiguePercent(score) : null }
  })
  const load = days.reduce((s, x) => s + x.load, 0)
  const minutes = logs.data.filter(l => l.session_date >= start).reduce((s, l) => s + l.duration_min, 0)
  const s = (n: number) => (n > 1 ? 's' : '')
  const max = Math.max(300, ...days.map(x => x.load))

  return (
    <Card title="Ma semaine"
      help="Barre : ta charge du jour (effort × minutes). Point : ta fatigue — vert ça va, jaune moyen, rouge à surveiller.">
      <p className="leading-snug">
        <strong>{declared} activité{s(declared)} déclarée{s(declared)}</strong>{planned > 0 && <> sur {planned} prévue{s(planned)}</>} depuis lundi
        {' · '}<strong>{load.toLocaleString('fr-FR')} UA</strong> en {minutes} min.
        {fatigue !== null && <> Fatigue moyenne <strong>{fatigue} %</strong>{trend && <>, <span className={trend === 'en hausse' ? 'text-rnr' : trend === 'en baisse' ? 'text-ok' : ''}>{trend}</span> par rapport à la semaine dernière</>}.</>}
      </p>
      <ol className="grid grid-cols-7 gap-1.5">
        {days.map((x, i) => (
          <li key={x.d} className={`flex flex-col items-center gap-1.5 ${x.d > date ? 'opacity-35' : ''}`}
            aria-label={`${formatDay(x.d)} : ${x.load ? `${x.load} UA` : 'pas de charge'}${x.fatigue !== null ? `, fatigue ${x.fatigue} %` : ''}`}>
            <div className="flex h-16 w-full items-end justify-center rounded-md bg-field" aria-hidden="true">
              {x.load > 0 && <div className={`w-1/2 rounded-sm ${x.d === date ? 'bg-rnr' : 'bg-ink/70'}`} style={{ height: `${Math.max(8, (100 * x.load) / max)}%` }} />}
            </div>
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${x.fatigue === null ? 'border border-line' : DOT[postureOf(x.fatigue)]}`} />
            <span aria-hidden="true" className={`font-display text-sm font-semibold ${x.d === date ? 'text-ink' : 'text-ink/50'}`}>{DAY_LETTERS[i]}</span>
          </li>
        ))}
      </ol>
      {footer}
    </Card>
  )
}

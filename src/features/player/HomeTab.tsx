import { Card } from '../../components/ui/Card'
import { addDays, isoWeekStart } from '../../lib/week'
import { upcomingByDay } from '../rpe/activities'
import { useAvailability, usePlanRange } from '../rpe/useRpe'
import { completion } from '../seances/program'
import { useWeekProgram } from '../seances/useSeance'
import { MyGoals } from '../tests/MyGoals'
import { FatigueBody } from '../wellness/FatigueBody'
import { fatiguePercent } from '../wellness/fatigue'
import { useWellnessDay } from '../wellness/useWellness'
import { useLogsRange } from '../rpe/useRpe'
import { MyWeek } from './MyWeek'
import { usePlayerDay } from './playerDay'
import { Loading } from '../../components/ui/Loading'

const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })

// Accueil : résumé de la semaine (fatigue, charge, musculation, à venir, objectifs)
export function HomeTab() {
  const { playerId, today } = usePlayerDay()
  return (
    <>
      <Scoreboard playerId={playerId} today={today} />
      <MyWeek playerId={playerId} date={today} footer={<MuscuWeek playerId={playerId} today={today} />} />
      <Upcoming playerId={playerId} today={today} />
      <MyGoals playerId={playerId} date={today} />
    </>
  )
}

// Le tableau d'affichage : fatigue du jour et charge de la semaine, lisibles d'un coup d'œil
function Scoreboard({ playerId, today }: { playerId: string; today: string }) {
  const wellness = useWellnessDay(playerId, today)
  const week = isoWeekStart(today)
  const logs = useLogsRange(playerId, [week, addDays(today, -6)].sort()[0], today) // même requête que « Ma semaine » : servie par le cache
  const w = wellness.data
  const load = logs.data?.filter(l => l.session_date >= week).reduce((sum, l) => sum + Number(l.srpe ?? 0), 0)

  return (
    <section aria-label="Mon tableau du jour" className="flex items-center gap-4 rounded-lg border border-line bg-surface px-4 py-3">
      {w && w.score !== null && <FatigueBody wellness={w} score={w.score} figureOnly />}
      <dl className="grid flex-1 grid-cols-2 divide-x divide-line">
        <div className="pr-3 flex flex-col-reverse">
          <dt className="mt-1 text-sm text-ink/60">Fatigue du jour</dt>
          <dd className="font-display text-[clamp(2.4rem,12vw,3.75rem)] font-bold leading-none tabular-nums">{w?.score != null ? fatiguePercent(w.score) : '–'}<span className="text-2xl">%</span></dd>
        </div>
        <div className="pl-3 flex flex-col-reverse">
          <dt className="mt-1 text-sm text-ink/60">UA cette semaine</dt>
          <dd className="font-display text-[clamp(2.4rem,12vw,3.75rem)] font-bold leading-none tabular-nums">{load ?? '–'}</dd>
        </div>
      </dl>
    </section>
  )
}

function MuscuWeek({ playerId, today }: { playerId: string; today: string }) {
  const from = isoWeekStart(today)
  const program = useWeekProgram(playerId, from, addDays(from, 6))
  if (!program.data?.length) return null
  const done = program.data.filter(s => s.session_date <= today).flatMap(s => s.planned_exercises)
  const c = completion(done)
  const left = program.data.filter(s => s.session_date > today).length
  return (
    <p className="text-sm">
      <span className="font-semibold">Musculation</span> <span className="text-ink/70">
        {c.done}/{c.total} exercices faits ({c.pct} %){left > 0 && ` · ${left} séance${left > 1 ? 's' : ''} encore prévue${left > 1 ? 's' : ''}`}
      </span>
    </p>
  )
}

function Upcoming({ playerId, today }: { playerId: string; today: string }) {
  const plan = usePlanRange(playerId, today, addDays(today, 6))
  const availability = useAvailability(playerId)
  if (plan.isPending || availability.isPending) return <Card title="À venir"><Loading /></Card>
  if (plan.isError || availability.isError) return <Card title="À venir"><p>Impossible de charger ton planning.</p></Card>

  // les 3 prochains jours avec activité : la suite se voit le moment venu, l'accueil reste court
  const days = upcomingByDay(plan.data, { injured: availability.data === 'blessé' }).slice(0, 3)
  return (
    <Card title="À venir">
      {days.length === 0 && <p className="text-sm text-ink/70">Rien de prévu sur les 7 prochains jours.</p>}
      <ul className="flex flex-col gap-2 text-sm">
        {days.map(d => (
          <li key={d.date} className="grid grid-cols-[5.5rem_1fr] gap-2">
            <span className="font-display font-semibold first-letter:uppercase">{d.date === today ? "Aujourd'hui" : shortDay(d.date)}</span>
            <span className="text-ink/75">{d.activities.map(a => a.durationMin ? `${a.name} ${a.durationMin}'` : a.name).join(' · ')}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

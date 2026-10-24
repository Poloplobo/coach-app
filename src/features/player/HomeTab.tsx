import { Card } from '../../components/ui/Card'
import { addDays, formatDay, isoWeekStart } from '../../lib/week'
import { upcomingByDay } from '../rpe/activities'
import { useAvailability, usePlanRange } from '../rpe/useRpe'
import { completion } from '../seances/program'
import { useWeekProgram } from '../seances/useSeance'
import { MyGoals } from '../tests/MyGoals'
import { FatigueBody } from '../wellness/FatigueBody'
import { useWellnessDay } from '../wellness/useWellness'
import { MyWeek } from './MyWeek'
import { usePlayerDay } from './playerDay'

// Accueil : résumé de la semaine (fatigue, charge, musculation, à venir, objectifs)
export function HomeTab() {
  const { playerId, today } = usePlayerDay()
  return (
    <>
      <FatigueToday playerId={playerId} today={today} />
      <MyWeek playerId={playerId} date={today} />
      <MuscuWeek playerId={playerId} today={today} />
      <Upcoming playerId={playerId} today={today} />
      <MyGoals playerId={playerId} date={today} />
    </>
  )
}

function FatigueToday({ playerId, today }: { playerId: string; today: string }) {
  const wellness = useWellnessDay(playerId, today)
  if (!wellness.data || wellness.data.score === null) return null
  return <Card title="Mon état de fatigue"><FatigueBody wellness={wellness.data} score={wellness.data.score} compact /></Card>
}

function MuscuWeek({ playerId, today }: { playerId: string; today: string }) {
  const from = isoWeekStart(today)
  const program = useWeekProgram(playerId, from, addDays(from, 6))
  if (!program.data?.length) return null
  const done = program.data.filter(s => s.session_date <= today).flatMap(s => s.planned_exercises)
  const c = completion(done)
  const left = program.data.filter(s => s.session_date > today).length
  return (
    <Card title="Ma musculation">
      <p><span className="text-2xl font-bold">{c.pct} %</span> <span className="text-ink/60">des exercices faits ({c.done}/{c.total})</span></p>
      {left > 0 && <p className="text-sm text-ink/70">{left} séance{left > 1 ? 's' : ''} encore prévue{left > 1 ? 's' : ''} cette semaine</p>}
    </Card>
  )
}

function Upcoming({ playerId, today }: { playerId: string; today: string }) {
  const plan = usePlanRange(playerId, today, addDays(today, 6))
  const availability = useAvailability(playerId)
  if (plan.isPending || availability.isPending) return <Card title="À venir"><p className="text-ink/60">Chargement…</p></Card>
  if (plan.isError || availability.isError) return <Card title="À venir"><p>Impossible de charger ton planning.</p></Card>

  const days = upcomingByDay(plan.data, { injured: availability.data === 'blessé' })
  return (
    <Card title="À venir">
      {days.length === 0 && <p className="text-sm text-ink/70">Rien de prévu sur les 7 prochains jours.</p>}
      <ul className="flex flex-col gap-2 text-sm">
        {days.map(d => (
          <li key={d.date}>
            <p className="font-semibold capitalize">{d.date === today ? "Aujourd'hui" : formatDay(d.date)}</p>
            <p className="text-ink/70">{d.activities.map(a => a.durationMin ? `${a.name} (${a.durationMin} min)` : a.name).join(' · ')}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

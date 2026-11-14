import { lazy, Suspense } from 'react'
import { TodayActivities } from '../rpe/TodayActivities'
import { useCatchUpDay } from '../rpe/useRpe'
import { MuscuSessionCard } from '../seances/MuscuSessionCard'
import { useWeekProgram } from '../seances/useSeance'
import { EXERCISE_SESSIONS, MUSCULATION } from '../rpe/activities'
import { addDays, isoWeekStart } from '../../lib/week'
import { WellnessCard } from '../wellness/WellnessCard'
import { usePlayerDay } from './playerDay'
import { useFeature } from '../follow/feature'

// Suivi individuel (étape 14) : chargé à part, jamais téléchargé tant que le drapeau est fermé
const FollowSection = lazy(() => import('../follow/FollowSection'))

export function SeanceTab() {
  const { playerId, today } = usePlayerDay()
  const catchUp = useCatchUpDay(playerId, today).data
  // Une carte par type de séance programmé cette semaine : la musculation, ou pour un blessé la réhab et les membres sains
  const monday = isoWeekStart(today)
  const program = useWeekProgram(playerId, monday, addDays(monday, 6))
  const yesterdayWeek = useWeekProgram(playerId, isoWeekStart(catchUp ?? today), addDays(isoWeekStart(catchUp ?? today), 6)) // rattrapage d'un dimanche
  if (program.isPending) return null // pas de carte « Musculation » furtive chez un blessé
  const week = [...(program.data ?? []), ...(yesterdayWeek.data ?? [])]
  const found = EXERCISE_SESSIONS.filter(a => week.some(s => s.activity_types.name === a))
  const activities = found.length ? found : [MUSCULATION]
  return (
    <>
      {catchUp && activities.map(a => <MuscuSessionCard key={`hier-${a}`} playerId={playerId} date={catchUp} activity={a} catchUp />)}
      {activities.map(a => <MuscuSessionCard key={a} playerId={playerId} date={today} activity={a} />)}
    </>
  )
}

export function RugbyTab() {
  const { playerId, today } = usePlayerDay()
  const catchUp = useCatchUpDay(playerId, today).data
  return <>{catchUp && <TodayActivities playerId={playerId} date={catchUp} title="Mes activités d'hier (relance du staff)" />}<TodayActivities playerId={playerId} date={today} /></>
}

export function FormeTab() {
  const { playerId, today } = usePlayerDay()
  const follow = useFeature()
  return <><WellnessCard playerId={playerId} date={today} />{follow && <Suspense fallback={null}><FollowSection playerId={playerId} today={today} /></Suspense>}</>
}

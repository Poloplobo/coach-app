import { TodayActivities } from '../rpe/TodayActivities'
import { useCatchUpDay } from '../rpe/useRpe'
import { MuscuSessionCard } from '../seances/MuscuSessionCard'
import { WellnessCard } from '../wellness/WellnessCard'
import { usePlayerDay } from './playerDay'

export function SeanceTab() {
  const { playerId, today } = usePlayerDay()
  const catchUp = useCatchUpDay(playerId, today).data
  return <>{catchUp && <MuscuSessionCard playerId={playerId} date={catchUp} catchUp />}<MuscuSessionCard playerId={playerId} date={today} /></>
}

export function RugbyTab() {
  const { playerId, today } = usePlayerDay()
  const catchUp = useCatchUpDay(playerId, today).data
  return <>{catchUp && <TodayActivities playerId={playerId} date={catchUp} title="Mes activités d'hier (relance du staff)" />}<TodayActivities playerId={playerId} date={today} /></>
}

export function FormeTab() {
  const { playerId, today } = usePlayerDay()
  return <WellnessCard playerId={playerId} date={today} />
}

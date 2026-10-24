import { TodayActivities } from '../rpe/TodayActivities'
import { MuscuSessionCard } from '../seances/MuscuSessionCard'
import { WellnessCard } from '../wellness/WellnessCard'
import { usePlayerDay } from './playerDay'

export function SeanceTab() {
  const { playerId, today } = usePlayerDay()
  return <MuscuSessionCard playerId={playerId} date={today} />
}

export function RugbyTab() {
  const { playerId, today } = usePlayerDay()
  return <TodayActivities playerId={playerId} date={today} />
}

export function FormeTab() {
  const { playerId, today } = usePlayerDay()
  return <WellnessCard playerId={playerId} date={today} />
}

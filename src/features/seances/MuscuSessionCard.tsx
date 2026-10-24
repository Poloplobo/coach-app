import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ScalePicker } from '../../components/ui/ScalePicker'
import { addDays, formatDay, isoWeekStart } from '../../lib/week'
import { MUSCULATION, RPE_LABELS } from '../rpe/activities'
import { useActivityTypes, useLogsRange } from '../rpe/useRpe'
import { ExerciseRow } from './ExerciseRow'
import { completion, sortedExercises } from './program'
import { useMarkNotDone, useValidateSession, useWeekProgram } from './useSeance'

export function MuscuSessionCard({ playerId, date }: { playerId: string; date: string }) {
  const from = isoWeekStart(date)
  const to = addDays(from, 6)
  const program = useWeekProgram(playerId, from, to)
  const logs = useLogsRange(playerId, from, to)
  const types = useActivityTypes()
  const validate = useValidateSession(playerId)
  const markNotDone = useMarkNotDone(playerId)
  const [rpe, setRpe] = useState<number | null>(null)
  const [duration, setDuration] = useState('')

  if (program.isPending || logs.isPending || types.isPending) return <Card title="Musculation"><p className="text-ink/60">Chargement…</p></Card>
  if (program.isError || logs.isError || types.isError) return <Card title="Musculation"><p>Impossible de charger ton programme.</p></Card>

  const muscuType = types.data.find(t => t.name === MUSCULATION)
  const session = program.data.find(s => s.session_date === date)
  const others = program.data.filter(s => s.session_date !== date)
  const weekList = others.length > 0 && (
    <ul className="text-sm border-t border-line pt-3 flex flex-col gap-1">
      {others.map(s => {
        const c = completion(s.planned_exercises)
        return (
          <li key={s.id} className="flex justify-between">
            <span className="capitalize">{formatDay(s.session_date)}</span>
            <span className="text-ink/70">{s.session_date < date ? `${c.done}/${c.total} faits` : `${c.total} exercices`}</span>
          </li>
        )
      })}
    </ul>
  )

  if (!session || !muscuType) {
    return <Card title="Musculation"><p className="text-sm text-ink/70">Pas de séance de musculation aujourd'hui.</p>{weekList}</Card>
  }

  const exercises = sortedExercises(session.planned_exercises)
  const log = logs.data.find(l => l.planned_session_id === session.id && l.validated_at)
  const c = completion(exercises)
  const plannedMinutes = session.planned_duration_min ?? muscuType.default_duration_min
  const minutes = duration ? Number(duration) : Number(plannedMinutes ?? 0)
  const validDuration = Number.isInteger(minutes) && minutes > 0 && minutes <= 300

  return (
    <Card title="Ma séance de musculation">
      <p className="text-sm text-ink/70">{c.done}/{c.total} exercices faits · {c.pct} %</p>
      <ul className="flex flex-col gap-3">
        {exercises.map(e => <ExerciseRow key={e.id} playerId={playerId} exercise={e} editable={!log} />)}
      </ul>

      {log ? (
        <p className="rounded-lg border border-ok px-3 py-2 text-sm">Séance validée · RPE {log.rpe} · {log.duration_min} min · {log.srpe} UA</p>
      ) : (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <ScalePicker label="RPE de la séance" min={0} max={10} low="Repos" high="Maximal" value={rpe} onChange={setRpe}
            hint={rpe !== null ? RPE_LABELS[rpe] : undefined} />
          <label className="flex items-center gap-3 text-sm">
            Durée
            <input type="number" inputMode="numeric" min={1} max={300} value={duration} placeholder={String(plannedMinutes ?? '')} onChange={e => setDuration(e.target.value)}
              className="w-20 rounded-lg bg-app border border-line px-3 py-2 text-base" />
            min
          </label>
          <p className="text-xs text-ink/60">Une fois validée, la séance ne peut plus être modifiée. Les exercices sans réponse seront notés « non fait ».</p>
          {(validate.isError || markNotDone.isError) && (
            <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">Enregistrement impossible, réessaie.</p>
          )}
          <Button disabled={rpe === null || !validDuration || validate.isPending}
            onClick={() => validate.mutate({
              date, plannedSessionId: session.id, activityTypeId: muscuType.id, durationMin: minutes, rpe: rpe!,
              unansweredExerciseIds: exercises.filter(e => !e.exercise_feedback[0]?.status).map(e => e.id),
            })}>
            {validate.isPending ? 'Validation…' : 'Valider la séance'}
          </Button>
          <Button variant="ghost" disabled={markNotDone.isPending} onClick={() => markNotDone.mutate(exercises.map(e => e.id))}>
            Séance non faite
          </Button>
        </div>
      )}
      {weekList}
    </Card>
  )
}

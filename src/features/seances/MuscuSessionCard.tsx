import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmButton } from '../../components/ui/ConfirmButton'
import { addDays, formatDay, isoWeekStart } from '../../lib/week'
import { MUSCULATION } from '../rpe/activities'
import { RpePicker } from '../rpe/RpePicker'
import { useActivityTypes, useLogsRange } from '../rpe/useRpe'
import { ExerciseRow } from './ExerciseRow'
import { completion, sortedExercises } from './program'
import { useMarkNotDone, useValidateSession, useWeekProgram } from './useSeance'
import { Loading } from '../../components/ui/Loading'

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
  const [finishing, setFinishing] = useState(false) // 2e étape : effort de la séance et validation

  if (program.isPending || logs.isPending || types.isPending) return <Card title="Musculation"><Loading /></Card>
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
            <span className="inline-block first-letter:uppercase">{formatDay(s.session_date)}</span>
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
    <Card title="Ma séance de musculation" aside={<span className="text-sm text-ink/60 tabular-nums">{c.done}/{c.total} faits</span>}
      help="1. Pour chaque exercice : fait, partiel ou non fait. 2. Terminer la séance : ton effort global, puis Valider.">
      <ul className="flex flex-col gap-3">
        {exercises.map(e => <ExerciseRow key={e.id} playerId={playerId} exercise={e} editable={!log} />)}
      </ul>

      {log ? (
        <p className="rounded-lg border border-ok px-3 py-2 text-sm">Séance validée · RPE {log.rpe} · {log.duration_min} min · {log.srpe} UA</p>
      ) : (
        !finishing ? (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <Button onClick={() => setFinishing(true)}>Terminer la séance</Button>
            {/* écrase aussi les exercices déjà notés « fait » : confirmation obligatoire */}
            <ConfirmButton variant="quiet" className="self-center" confirmLabel="Confirmer : tout passer en « non fait »" disabled={markNotDone.isPending}
              onClick={() => markNotDone.mutate(exercises.map(e => e.id))}>
              Séance non faite
            </ConfirmButton>
            {markNotDone.isError && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">Enregistrement impossible, réessaie.</p>}
          </div>
        ) : (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <RpePicker label="RPE de la séance" value={rpe} onChange={setRpe} />
          <label className="flex items-center gap-3 text-sm">
            Durée
            <input type="number" inputMode="numeric" min={1} max={300} value={duration} placeholder={String(plannedMinutes ?? '')} onChange={e => setDuration(e.target.value)}
              className="w-20 rounded-md bg-field border border-line px-3 py-2 text-base" />
            min
          </label>
          <p className="text-xs text-ink/60">Une fois validée, la séance ne peut plus être modifiée. Les exercices sans réponse seront notés « non fait ».</p>
          {validate.isError && (
            <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">Enregistrement impossible, réessaie.</p>
          )}
          <ConfirmButton confirmLabel="Confirmer : la séance sera verrouillée" disabled={rpe === null || !validDuration || validate.isPending}
            onClick={() => validate.mutate({
              date, plannedSessionId: session.id, activityTypeId: muscuType.id, durationMin: minutes, rpe: rpe!,
              unansweredExerciseIds: exercises.filter(e => !e.exercise_feedback[0]?.status).map(e => e.id),
            })}>
            {validate.isPending ? 'Validation…' : 'Valider la séance'}
          </ConfirmButton>
          <Button variant="quiet" className="self-center" onClick={() => setFinishing(false)}>Retour aux exercices</Button>
        </div>
        )
      )}
      {weekList}
    </Card>
  )
}

import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmButton } from '../../components/ui/ConfirmButton'
import { addDays, formatDay, isoWeekStart } from '../../lib/week'
import { MUSCULATION } from '../rpe/activities'
import { RpePicker } from '../rpe/RpePicker'
import { useActivityTypes, useLogsRange } from '../rpe/useRpe'
import { ExerciseRow } from './ExerciseRow'
import { blockGroups, completion, sortedExercises } from './program'
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
  // Bande de la semaine : une case par jour, séance faite (validée), aujourd'hui, à venir ou sans muscu
  const validated = new Set(logs.data.filter(l => l.validated_at && l.planned_session_id).map(l => l.planned_session_id))
  const strip = (
    <ol aria-label="Mes séances de musculation de la semaine" className="grid grid-cols-7 gap-1.5">
      {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d, i) => {
        const s = program.data.find(x => x.session_date === d)
        const done = s && validated.has(s.id), isToday = d === date
        const label = !s ? 'pas de musculation' : done ? `séance faite (${completion(s.planned_exercises).done}/${s.planned_exercises.length})` : d < date ? 'séance non validée' : isToday ? "séance d'aujourd'hui" : 'séance à venir'
        return (
          <li key={d} aria-label={`${formatDay(d)} : ${label}`}
            className={`flex h-12 flex-col items-center justify-center rounded-lg text-xs font-display font-semibold ${
              !s ? 'text-ink/45' : done ? 'bg-ok/15 text-ok' : isToday ? 'bg-rnr text-white' : d < date ? 'bg-field text-ink/50' : 'bg-field text-ink'}`}>
            <span aria-hidden="true">{'LMMJVSD'[i]}</span>
            <span aria-hidden="true" className="text-sm">{!s ? '·' : done ? '✓' : d < date ? '–' : '●'}</span>
          </li>
        )
      })}
    </ol>
  )
  const next = others.find(x => x.session_date > date)

  if (!session || !muscuType) {
    return (
      <Card title="Musculation" help="Ta semaine de musculation : ✓ séance faite, ● séance prévue.">
        {strip}
        <p className="text-sm text-ink/70">
          Pas de séance aujourd'hui.{next && <> Prochaine : <strong className="text-ink first-letter:uppercase">{formatDay(next.session_date)}</strong> ({next.planned_exercises.length} exercices).</>}
        </p>
      </Card>
    )
  }

  const exercises = sortedExercises(session.planned_exercises)
  const log = logs.data.find(l => l.planned_session_id === session.id && l.validated_at)
  const c = completion(exercises)
  const plannedMinutes = session.planned_duration_min ?? muscuType.default_duration_min
  const minutes = duration ? Number(duration) : Number(plannedMinutes ?? 0)
  const validDuration = Number.isInteger(minutes) && minutes > 0 && minutes <= 300

  return (
    <Card title="Ma séance de musculation"
      help="1. Pour chaque exercice : fait, partiel ou non fait. 2. Terminer la séance : ton effort global, puis Valider.">
      {strip}
      <div className="flex items-center gap-3" aria-label={`${c.done} exercices faits sur ${c.total}`}>
        <div className="h-2 flex-1 rounded-full bg-field" aria-hidden="true">
          <div className="h-2 rounded-full bg-ok transition-[width] duration-500" style={{ width: `${c.pct}%` }} />
        </div>
        <span className="text-sm tabular-nums text-ink/70">{c.done}/{c.total} faits</span>
      </div>
      {/* Blocs de la fiche : les exercices d'un même bloc (A1, A2…) s'enchaînent, reliés par un trait */}
      <div className="flex flex-col gap-4">
        {blockGroups(exercises).map(g => (
          <section key={g.key + g.items[0].id} aria-label={g.label}>
            <h3 className="mb-1 font-display text-base font-semibold text-gold">{g.label}{g.items.length > 1 && <span className="ml-2 font-sans text-xs font-normal text-ink/50">enchaîner</span>}</h3>
            <ul className={`flex flex-col gap-3 ${g.items.length > 1 ? 'border-l-2 border-gold/40 pl-3' : ''}`}>
              {g.items.map(e => <ExerciseRow key={e.id} playerId={playerId} exercise={e} editable={!log} />)}
            </ul>
          </section>
        ))}
      </div>

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
    </Card>
  )
}

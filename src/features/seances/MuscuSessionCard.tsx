import { useState } from 'react'
import { Layers, ListChecks, Timer } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { OfflineNote } from '../../components/ui/OfflineNote'
import { ConfirmButton } from '../../components/ui/ConfirmButton'
import { addDays, formatDay, isoWeekStart } from '../../lib/week'
import { MUSCULATION } from '../rpe/activities'
import { RpePicker } from '../rpe/RpePicker'
import { useActivityTypes, useLogsRange } from '../rpe/useRpe'
import { ExerciseRow } from './ExerciseRow'
import { blockGroups, completion, lastLoads, sessionRpe, sortedExercises } from './program'
import { useMarkNotDone, usePastLoads, useRedoMuscu, useReferenceMaxes, useValidateSession, useWeekProgram } from './useSeance'
import { Loading } from '../../components/ui/Loading'

// catchUp : séance d'hier rouverte par une relance du staff ; rien à afficher si elle n'existe pas ou est déjà validée.
// activity : Musculation, ou pour un blessé Réhabilitation / Membres sains (une carte par séance, douleur EVA par exercice)
export function MuscuSessionCard({ playerId, date, catchUp = false, activity = MUSCULATION }: { playerId: string; date: string; catchUp?: boolean; activity?: string }) {
  const from = isoWeekStart(date)
  const to = addDays(from, 6)
  const program = useWeekProgram(playerId, from, to)
  const logs = useLogsRange(playerId, from, to)
  const types = useActivityTypes()
  const validate = useValidateSession(playerId)
  const markNotDone = useMarkNotDone(playerId)
  const redo = useRedoMuscu(playerId)
  // Repères (facultatifs : en cas d'échec, la séance s'affiche sans eux)
  const maxes = useReferenceMaxes(playerId).data
  const past = usePastLoads(playerId, date).data
  const [rpe, setRpe] = useState<number | null>(null)
  const [duration, setDuration] = useState('')
  const [finishing, setFinishing] = useState(false) // 2e étape : effort de la séance et validation

  if (catchUp && (program.isPending || logs.isPending || types.isPending)) return null
  if (program.isPending || logs.isPending || types.isPending) return <Card title={activity}><Loading /></Card>
  if (program.isError || logs.isError || types.isError) return <Card title={activity}><p>Impossible de charger ton programme.</p></Card>

  const muscuType = types.data.find(t => t.name === activity)
  const week = program.data.filter(s => s.activity_types.name === activity)
  const session = week.find(s => s.session_date === date)
  const others = week.filter(s => s.session_date !== date)
  const rehab = activity !== MUSCULATION
  const label = activity === MUSCULATION ? 'musculation' : activity.toLowerCase()
  // Bande de la semaine : une case par jour, séance faite (validée), aujourd'hui, à venir ou sans muscu
  const validated = new Set(logs.data.filter(l => l.validated_at && l.planned_session_id).map(l => l.planned_session_id))
  const strip = (
    <ol aria-label={`Mes séances de ${label} de la semaine`} className="grid grid-cols-7 gap-1.5">
      {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d, i) => {
        const s = week.find(x => x.session_date === d)
        const done = s && validated.has(s.id), isToday = d === date
        const label = !s ? 'pas de musculation' : done ? `séance faite (${completion(s.planned_exercises).done}/${s.planned_exercises.length})` : d < date ? 'séance non validée' : isToday ? (catchUp ? "séance d'hier à remplir" : "séance d'aujourd'hui") : 'séance à venir'
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

  if (catchUp && (!session || !muscuType || logs.data.some(l => l.planned_session_id === session.id && l.validated_at))) return null
  if (!session || !muscuType) {
    return (
      <Card title={activity} help={`Ta semaine de ${label} : ✓ séance faite, ● séance prévue.`}>
        {strip}
        <p className="text-sm text-ink/70">
          Pas de séance aujourd'hui.{next && <> Prochaine : <strong className="text-ink first-letter:uppercase">{formatDay(next.session_date)}</strong> ({next.planned_exercises.length} exercices).</>}
        </p>
        {/* Séance d'un jour passé de la semaine, non validée : le joueur peut la faire aujourd'hui (une par jour) */}
        {!catchUp && muscuType && others.filter(s => s.session_date < date && !validated.has(s.id)).map(s => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold/60 px-3 py-2 text-sm">
            <span>Séance manquée : <strong className="first-letter:uppercase">{formatDay(s.session_date)}</strong> ({s.planned_exercises.length} exercices)</span>
            <ConfirmButton size="sm" confirmLabel="Confirmer : la faire aujourd'hui" disabled={redo.isPending} onClick={() => redo.mutate(s.id)}>
              {redo.isPending ? '…' : 'La faire aujourd\'hui'}
            </ConfirmButton>
          </div>
        ))}
        {redo.isError && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">{(redo.error as { message?: string } | null)?.message?.match(/(séance|tu as)[^.]*/)?.[0] ?? 'Impossible de reprendre la séance, réessaie.'}</p>}
      </Card>
    )
  }

  const exercises = sortedExercises(session.planned_exercises)
  const last = lastLoads(past ?? [])
  const log = logs.data.find(l => l.planned_session_id === session.id && l.validated_at)
  const c = completion(exercises)
  const plannedMinutes = session.planned_duration_min ?? muscuType.default_duration_min
  const minutes = duration ? Number(duration) : Number(plannedMinutes ?? 0)
  const validDuration = Number.isInteger(minutes) && minutes > 0 && minutes <= 300
  const computed = sessionRpe(exercises)
  const sessionEffort = computed?.rpe ?? rpe

  return (
    // En-tête façon « séance du jour » : titre, pastilles (durée, exercices, blocs), semaine et progression ; la fiche suit
    <section aria-label={catchUp ? `Ma séance d'hier : ${label}` : `Ma séance de ${label}`} className="flex flex-col gap-4">
      <div className={`flex flex-col gap-3 rounded-3xl bg-surface p-5 ${catchUp ? 'ring-2 ring-gold' : 'ring-1 ring-line/60'}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/55 first-letter:uppercase">{catchUp ? "Relance du staff · séance d'hier" : `${formatDay(date)}`}</p>
        <h2 className="font-display text-2xl font-semibold leading-tight first-letter:uppercase">{rehab ? activity : 'Ma séance de musculation'}</h2>
        <ul className="flex flex-wrap gap-1.5 text-sm">
          {plannedMinutes ? <li className="flex items-center gap-1 rounded-full bg-field px-2.5 py-1"><Timer size={14} aria-hidden="true" />{plannedMinutes} min</li> : null}
          <li className="flex items-center gap-1 rounded-full bg-field px-2.5 py-1"><ListChecks size={14} aria-hidden="true" />{exercises.length} exercices</li>
          <li className="flex items-center gap-1 rounded-full bg-field px-2.5 py-1"><Layers size={14} aria-hidden="true" />{blockGroups(exercises).length} blocs</li>
        </ul>
        {strip}
        <div className="flex items-center gap-3" aria-label={`${c.done} exercices faits sur ${c.total}`}>
          <div className="h-2 flex-1 rounded-full bg-field" aria-hidden="true">
            <div className="h-2 rounded-full bg-ok transition-[width] duration-500" style={{ width: `${c.pct}%` }} />
          </div>
          <span className="text-sm tabular-nums text-ink/70">{c.done}/{c.total} faits</span>
        </div>
      </div>
      <p className="px-1 text-sm text-ink/60">Note chaque exercice (fait, partiel ou non fait, et ton RPE), puis termine la séance.</p>
      {/* Blocs de la fiche : les exercices d'un même bloc (A1, A2…) s'enchaînent ; l'en-tête le dit et compte les faits */}
      <div className="flex flex-col gap-3">
        {blockGroups(exercises).map(g => {
          const gc = completion(g.items)
          const rounds = new Set(g.items.map(e => e.sets))
          const sets = rounds.size === 1 ? g.items[0].sets : null
          return (
            <section key={g.key + g.items[0].id} aria-label={g.label} className="rounded-xl bg-surface ring-1 ring-line/60">
              <header className="flex items-center gap-3 border-b border-line/60 px-3 py-2.5">
                <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold ${gc.done === gc.total ? 'bg-ok/15 text-ok' : 'bg-gold/15 text-gold'}`}>
                  {g.key === 'MOB' ? 'M' : g.key === '—' ? '•' : g.key}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-semibold leading-tight">{g.label}</h3>
                  {g.items.length > 1 && <p className="text-xs text-ink/60">{g.items.length} exercices à enchaîner{sets ? ` · ${sets} tours` : ''}</p>}
                </div>
                <span className="text-sm tabular-nums text-ink/60" aria-label={`${gc.done} faits sur ${gc.total}`}>{gc.done}/{gc.total}</span>
              </header>
              <ul className="divide-y divide-line/60 px-3">
                {g.items.map(e => <ExerciseRow key={e.id} playerId={playerId} exercise={e} editable={!log} maxes={maxes} pain={rehab}
                  last={e.exercise_id ? last.get(e.exercise_id) : undefined} />)}
              </ul>
            </section>
          )
        })}
      </div>

      {log ? (
        <p className="rounded-lg border border-ok px-3 py-2 text-sm">Séance validée{log.source === 'auto' ? ' automatiquement (23h30)' : ''} · RPE {Number(log.rpe).toLocaleString('fr-FR')} · {log.duration_min} min · {Math.round(Number(log.srpe))} UA</p>
      ) : (
        !finishing ? (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <Button onClick={() => setFinishing(true)}>Terminer la séance</Button>
            {/* écrase aussi les exercices déjà notés « fait » : confirmation obligatoire */}
            <ConfirmButton variant="quiet" className="self-center" confirmLabel="Confirmer : tout passer en « non fait »" disabled={markNotDone.isPending}
              onClick={() => markNotDone.mutate(exercises.map(e => e.id))}>
              Séance non faite
            </ConfirmButton>
            <OfflineNote shown={markNotDone.isPaused} />
            {markNotDone.isError && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">Enregistrement impossible, réessaie.</p>}
          </div>
        ) : (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          {computed ? (
            <p className="rounded-lg bg-field px-3 py-2 text-sm">
              RPE de la séance : <strong className="text-base">{computed.rpe.toLocaleString('fr-FR')}</strong>
              <span className="text-ink/60"> · moyenne de tes {computed.count} exercice{computed.count > 1 ? 's' : ''} noté{computed.count > 1 ? 's' : ''}</span>
              {validDuration && <span className="text-ink/60"> · {Math.round(computed.rpe * minutes)} UA</span>}
            </p>
          ) : <RpePicker label="RPE de la séance" value={rpe} onChange={setRpe} />}
          <label className="flex items-center gap-3 text-sm">
            Durée
            <input type="number" inputMode="numeric" min={1} max={300} value={duration} placeholder={String(plannedMinutes ?? '')} onChange={e => setDuration(e.target.value)}
              className="w-20 rounded-md bg-field border border-line px-3 py-2 text-base" />
            min
          </label>
          <p className="text-xs text-ink/60">Une fois validée, la séance ne peut plus être modifiée. Les exercices sans réponse seront notés « non fait ».</p>
          <OfflineNote shown={validate.isPaused} />
          {validate.isError && (
            <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">
              {(validate.error as { code?: string } | null)?.code === '42501' ? 'Délai dépassé : cette séance n\'est plus modifiable, demande au staff.' : 'Enregistrement impossible, réessaie.'}
            </p>
          )}
          <ConfirmButton confirmLabel="Confirmer : la séance sera verrouillée" disabled={sessionEffort === null || !validDuration || validate.isPending}
            onClick={() => validate.mutate({
              date, plannedSessionId: session.id, activityTypeId: muscuType.id, durationMin: minutes, rpe: sessionEffort!,
              unansweredExerciseIds: exercises.filter(e => !e.exercise_feedback[0]?.status).map(e => e.id),
            })}>
            {validate.isPending ? 'Validation…' : 'Valider la séance'}
          </ConfirmButton>
          <Button variant="quiet" className="self-center" onClick={() => setFinishing(false)}>Retour aux exercices</Button>
        </div>
        )
      )}
    </section>
  )
}

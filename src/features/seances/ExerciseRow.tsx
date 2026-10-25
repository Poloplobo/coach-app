import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { SavedFlash } from '../../components/ui/SavedFlash'
import { useSavedFlash } from '../../components/ui/useSavedFlash'
import { RpePicker } from '../rpe/RpePicker'
import { STATUSES, prescription, type FeedbackStatus, type PlannedExercise } from './program'
import { useSaveFeedback } from './useSeance'

const STATUS_LABEL: Record<string, string> = { fait: 'Fait', partiel: 'Partiel', 'non fait': 'Non fait' }

export function ExerciseRow({ playerId, exercise, editable }: { playerId: string; exercise: PlannedExercise; editable: boolean }) {
  const saved = exercise.exercise_feedback[0]
  const save = useSaveFeedback(playerId)
  const [flash, showFlash] = useSavedFlash()
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<FeedbackStatus | null>((saved?.status as FeedbackStatus) ?? null)
  const [doneLoad, setDoneLoad] = useState(saved?.done_load ?? '')
  const [rpe, setRpe] = useState<number | null>(saved?.rpe ?? null)
  const [comment, setComment] = useState(saved?.comment ?? '')

  // Repartir du dernier enregistrement (il a pu changer, ex. « Séance non faite »)
  const startEditing = () => {
    setStatus((saved?.status as FeedbackStatus) ?? null)
    setDoneLoad(saved?.done_load ?? '')
    setRpe(saved?.rpe ?? null)
    setComment(saved?.comment ?? '')
    setEditing(true)
  }

  const header = (
    <div className="flex gap-3">
      <span className="w-11 shrink-0 rounded bg-field border border-line py-0.5 text-center text-xs font-bold h-fit">{exercise.block_label}</span>
      <div>
        <p className="font-semibold">{exercise.exercises.name}</p>
        <p className="text-sm text-ink/70">{prescription(exercise)}</p>
      </div>
    </div>
  )

  if (!editable || (saved?.status && !editing)) {
    return (
      <li className="flex items-start justify-between gap-3 border-t border-line pt-3">
        <div className="flex flex-col gap-1">
          {header}
          {saved?.status && (
            <p className="text-sm pl-14">
              <span className={saved.status === 'fait' ? 'text-ok font-semibold' : saved.status === 'partiel' ? 'text-gold font-semibold' : 'text-ink/60 font-semibold'}>
                {STATUS_LABEL[saved.status]}
              </span>
              {saved.rpe !== null ? ` · RPE ${saved.rpe}` : ''}{saved.done_load ? ` · ${saved.done_load}` : ''}
              {saved.comment && <span className="block text-ink/60">« {saved.comment} »</span>}
            </p>
          )}
          <span className="pl-14"><SavedFlash shown={flash} /></span>
        </div>
        {editable && <Button variant="quiet" onClick={startEditing}>Modifier</Button>}
      </li>
    )
  }

  const submit = () => save.mutate(
    { plannedExerciseId: exercise.id, status: status!, doneLoad: doneLoad.trim() || null, rpe, comment: comment.trim() || null },
    { onSuccess: () => { setEditing(false); showFlash() } },
  )

  return (
    <li className="flex flex-col gap-3 border-t border-line pt-3">
      {header}
      <div role="radiogroup" aria-label="Statut" className="grid grid-cols-3 gap-1.5">
        {STATUSES.map(s => (
          <button key={s.value} type="button" role="radio" aria-checked={status === s.value} onClick={() => setStatus(s.value)}
            className={`h-9 rounded-md border text-sm font-semibold ${status === s.value ? 'bg-rnr border-rnr text-white' : 'bg-field border-line'}`}>
            {s.label}
          </button>
        ))}
      </div>
      {status && status !== 'non fait' && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Charge réalisée
            <input value={doneLoad} onChange={e => setDoneLoad(e.target.value)} placeholder="ex. 2x125 1x120"
              className="rounded-lg bg-field border border-line px-3 py-2 text-base" />
          </label>
          <RpePicker label="RPE de l'exercice" value={rpe} onChange={setRpe} />
        </>
      )}
      {/* tant qu'aucun statut n'est choisi, l'exercice reste compact : la séance se lit d'un coup d'œil */}
      {status && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Commentaire (facultatif)
            <input value={comment} onChange={e => setComment(e.target.value)} placeholder="ex. douleur, manque de temps"
              className="rounded-lg bg-field border border-line px-3 py-2 text-base" />
          </label>
          {save.isError && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">Enregistrement impossible, réessaie.</p>}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={submit} disabled={save.isPending}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button>
            {saved?.status && <Button variant="quiet" onClick={() => setEditing(false)}>Annuler</Button>}
          </div>
        </>
      )}
    </li>
  )
}

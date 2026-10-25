import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { ScalePicker } from '../../components/ui/ScalePicker'
import { SavedFlash } from '../../components/ui/SavedFlash'
import { useSavedFlash } from '../../components/ui/useSavedFlash'
import { RPE_LABELS } from '../rpe/activities'
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
      <span className="shrink-0 rounded bg-app border border-line px-2 py-0.5 text-xs font-bold h-fit">{exercise.block_label}</span>
      <div>
        <p className="font-semibold">{exercise.exercises.name}</p>
        <p className="text-sm text-ink/70">{prescription(exercise)}</p>
      </div>
    </div>
  )

  if (!editable || (saved?.status && !editing)) {
    return (
      <li className="flex flex-col gap-2 border-t border-line pt-3">
        {header}
        {saved?.status && (
          <p className="text-sm">
            {STATUS_LABEL[saved.status]}{saved.rpe !== null ? ` · RPE ${saved.rpe}` : ''}{saved.done_load ? ` · ${saved.done_load}` : ''}
            {saved.comment && <span className="block text-ink/60">« {saved.comment} »</span>}
          </p>
        )}
        <SavedFlash shown={flash} />
        {editable && <Button variant="ghost" onClick={startEditing}>Modifier</Button>}
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
            className={`h-11 rounded-lg border font-semibold ${status === s.value ? 'bg-rnr border-rnr text-white' : 'bg-app border-line'}`}>
            {s.label}
          </button>
        ))}
      </div>
      {status && status !== 'non fait' && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Charge réalisée
            <input value={doneLoad} onChange={e => setDoneLoad(e.target.value)} placeholder="ex. 2x125 1x120"
              className="rounded-lg bg-app border border-line px-3 py-2 text-base" />
          </label>
          <ScalePicker label="RPE de l'exercice" min={0} max={10} low="Repos" high="Maximal" value={rpe} onChange={setRpe}
            hint={rpe !== null ? RPE_LABELS[rpe] : undefined} />
        </>
      )}
      {/* tant qu'aucun statut n'est choisi, l'exercice reste compact : la séance se lit d'un coup d'œil */}
      {status && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Commentaire (facultatif)
            <input value={comment} onChange={e => setComment(e.target.value)} placeholder="ex. douleur, manque de temps"
              className="rounded-lg bg-app border border-line px-3 py-2 text-base" />
          </label>
          {save.isError && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">Enregistrement impossible, réessaie.</p>}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={submit} disabled={save.isPending}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button>
            {saved?.status && <Button variant="ghost" onClick={() => setEditing(false)}>Annuler</Button>}
          </div>
        </>
      )}
    </li>
  )
}

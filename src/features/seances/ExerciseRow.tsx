import { useState } from 'react'
import { Check, Minus, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { OfflineNote } from '../../components/ui/OfflineNote'
import { SavedFlash } from '../../components/ui/SavedFlash'
import { useSavedFlash } from '../../components/ui/useSavedFlash'
import { RpePicker } from '../rpe/RpePicker'
import { STATUSES, estimatedKg, prescriptionParts, type PastLoad, type ReferenceMax, type FeedbackStatus, type PlannedExercise } from './program'
import { RestTimer } from './RestTimer'
import { useSaveFeedback } from './useSeance'

const STATUS_LABEL: Record<string, string> = { fait: 'Fait', partiel: 'Partiel', 'non fait': 'Non fait' }
// Couleur du statut : vert fait, or partiel, neutre non fait (teinte + bord : lisible en thème clair comme sombre)
const STATUS_TONE: Record<string, string> = { fait: 'border-ok bg-ok/15 text-ok', partiel: 'border-gold bg-gold/15 text-gold', 'non fait': 'border-ink/40 bg-ink/10 text-ink/70' }
const STATUS_ICON = { fait: Check, partiel: Minus, 'non fait': X } as const

// Pastille de statut devant le nom : cercle vide tant que l'exercice n'est pas noté
function StatusMark({ status }: { status?: string | null }) {
  const Icon = status ? STATUS_ICON[status as FeedbackStatus] : null
  return (
    <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${status ? STATUS_TONE[status] : 'border-line'}`}>
      {Icon && <Icon size={14} strokeWidth={3} />}
    </span>
  )
}

const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })

// maxes / last : repères facultatifs (charge indicative d'un %RM, charge réalisée la dernière fois sur cet exercice)
export function ExerciseRow({ playerId, exercise, editable, maxes = [], last }: {
  playerId: string; exercise: PlannedExercise; editable: boolean; maxes?: ReferenceMax[]; last?: PastLoad
}) {
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

  // Fiche : code du bloc et nom, puis le volume en gros et la charge, le tempo, le repos en pastilles
  const p = prescriptionParts(exercise)
  const est = estimatedKg(exercise, maxes)
  const header = (
    <div className="flex gap-3">
      <StatusMark status={saved?.status} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="font-semibold leading-snug">
          {exercise.block_label && <span className="mr-1.5 font-display text-sm font-semibold text-ink/50">{exercise.block_label}</span>}
          {exercise.exercises.name}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {p.volume && <span className="mr-1 font-display text-xl font-semibold leading-none tabular-nums">{p.volume}</span>}
          {p.load && <span className="rounded-md bg-gold/15 px-2 py-0.5 font-semibold text-gold">{p.load}{est && ` ≈ ${est.kg.toLocaleString('fr-FR')} kg`}</span>}
          {p.tempo && <span className="rounded-md bg-field px-2 py-0.5 tabular-nums text-ink/80">tempo {p.tempo}</span>}
          {p.rest && <RestTimer rest={p.rest} />}
        </div>
        {p.note && <p className="text-sm text-ink/60">{p.note}</p>}
        {(est || last) && (
          <p className="text-xs text-ink/60">
            {est && <>d'après ton test {est.ref.test} ({est.ref.value.toLocaleString('fr-FR')} kg, {shortDate(est.ref.date)})</>}
            {est && last && <br />}
            {last && <>la dernière fois ({shortDate(last.date)}) : <span className="font-semibold text-ink/80">{last.done_load}</span></>}
          </p>
        )}
      </div>
    </div>
  )

  if (!editable || (saved?.status && !editing)) {
    return (
      <li className="flex items-start justify-between gap-3 py-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          {header}
          {saved?.status && (
            <p className="pl-9 text-sm">
              <span className={`font-semibold ${saved.status === 'fait' ? 'text-ok' : saved.status === 'partiel' ? 'text-gold' : 'text-ink/60'}`}>
                {STATUS_LABEL[saved.status]}
              </span>
              <span className="text-ink/70">{saved.rpe !== null ? ` · RPE ${saved.rpe}` : ''}{saved.done_load ? ` · ${saved.done_load}` : ''}</span>
              {saved.comment && <span className="block text-ink/60">« {saved.comment} »</span>}
              <SavedFlash shown={flash} />
            </p>
          )}
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
    <li className="flex flex-col gap-3 py-3">
      {header}
      <div className="flex flex-col gap-3 pl-9">
        <div role="radiogroup" aria-label="Statut" className="grid grid-cols-3 gap-1.5">
          {STATUSES.map(s => {
            const Icon = STATUS_ICON[s.value]
            return (
              <button key={s.value} type="button" role="radio" aria-checked={status === s.value} onClick={() => setStatus(s.value)}
                className={`flex h-10 items-center justify-center gap-1 rounded-lg border text-sm font-semibold transition-colors ${status === s.value ? STATUS_TONE[s.value] : 'border-line bg-field'}`}>
                <Icon size={15} strokeWidth={2.5} aria-hidden="true" />{s.label}
              </button>
            )
          })}
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
            <OfflineNote shown={save.isPaused} />
          {save.isError && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">{(save.error as { code?: string } | null)?.code === '42501' ? 'Délai dépassé : cette séance n\'est plus modifiable, demande au staff.' : 'Enregistrement impossible, réessaie.'}</p>}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={submit} disabled={save.isPending}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button>
              {saved?.status && <Button variant="quiet" onClick={() => setEditing(false)}>Annuler</Button>}
            </div>
          </>
        )}
      </div>
    </li>
  )
}

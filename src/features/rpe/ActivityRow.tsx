import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { OfflineNote } from '../../components/ui/OfflineNote'
import { SavedFlash } from '../../components/ui/SavedFlash'
import { useSavedFlash } from '../../components/ui/useSavedFlash'
import { SKIP_REASONS, type DayActivity, type SkipReason } from './activities'
import { RpePicker } from './RpePicker'
import { useDeleteSkip, useSaveLog, useSaveSkip } from './useRpe'

type Log = { duration_min: number; rpe: number | null; srpe: number | null; validated_at: string | null; source?: string }

type Skip = { reason: string; note: string | null }

export function ActivityRow({ playerId, date, activity, log, skip, onRemove }: {
  playerId: string; date: string; activity: DayActivity; log?: Log; skip?: Skip; onRemove?: () => void
}) {
  const save = useSaveLog(playerId)
  const unskip = useDeleteSkip(playerId)
  const [skipping, setSkipping] = useState(false)
  const [flash, showFlash] = useSavedFlash()
  const [editing, setEditing] = useState(!log)
  const [rpe, setRpe] = useState<number | null>(log?.rpe ?? null)
  const [duration, setDuration] = useState(String(log?.duration_min ?? activity.durationMin ?? ''))

  const minutes = Number(duration)
  const validDuration = Number.isInteger(minutes) && minutes > 0 && minutes <= 300

  if (log && !editing) {
    return (
      <li className="flex items-center gap-3 py-3">
        <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ok bg-ok/15 text-ok"><Check size={14} strokeWidth={3} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{activity.name}</p>
          <p className="text-sm text-ink/70">
            {activity.requiresRpe ? `RPE ${log.rpe} · ` : ''}{log.duration_min} min{activity.requiresRpe && <> · <strong className="font-semibold text-ink">{log.srpe} UA</strong></>}
            {' '}<SavedFlash shown={flash} />
          </p>
        </div>
        {/* une séance validée ou corrigée par le staff est verrouillée ; sinon modifiable toute la journée */}
        {log.source && log.source !== 'app' && <span className="text-xs text-ink/60">saisi par le staff</span>}
        {!log.validated_at && (!log.source || log.source === 'app') && <Button variant="quiet" onClick={() => setEditing(true)}>Modifier</Button>}
      </li>
    )
  }

  // Déclarée « pas faite » : plus d'oubli ; Annuler la retire pour saisir le RPE
  if (!log && skip) {
    return (
      <li className="flex items-center gap-3 py-3">
        <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-ink/60">–</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{activity.name}</p>
          <p className="text-sm text-ink/70">Pas fait · {SKIP_REASONS[skip.reason as SkipReason] ?? skip.reason}{skip.note ? ` : ${skip.note}` : ''}</p>
          {unskip.isError && <p role="alert" className="text-sm text-rnr">Modification impossible, réessaie.</p>}
        </div>
        <Button variant="quiet" disabled={unskip.isPending} onClick={() => unskip.mutate({ date, activityTypeId: activity.activityTypeId })}>Annuler</Button>
      </li>
    )
  }

  if (skipping) return <SkipForm playerId={playerId} date={date} activity={activity} onClose={() => setSkipping(false)} />

  const submit = () => save.mutate(
    { date, activityTypeId: activity.activityTypeId, plannedSessionId: activity.plannedSessionId, durationMin: minutes, rpe: activity.requiresRpe ? rpe : null },
    { onSuccess: () => { setEditing(false); showFlash() } },
  )

  return (
    <li className="flex flex-col gap-3 py-3">
      <p className="flex items-center gap-3 font-semibold">
        <span aria-hidden="true" className="h-6 w-6 shrink-0 rounded-full border border-line" />{activity.name}
      </p>
      <div className="flex flex-col gap-3 pl-9">
        {activity.requiresRpe && (
          <RpePicker label="Effort ressenti (RPE)" value={rpe} onChange={setRpe} />
        )}
        <label className="flex items-center gap-3 text-sm">
          Durée
          <input
            type="number" inputMode="numeric" min={1} max={300} value={duration} onChange={e => setDuration(e.target.value)}
            className="w-20 rounded-lg bg-field border border-line px-3 py-2 text-base"
          />
          min
        </label>
        <OfflineNote shown={save.isPaused} />
        {save.isError && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">{(save.error as { code?: string } | null)?.code === '42501' ? 'Délai dépassé : ce jour n\'est plus modifiable, demande au staff.' : 'Enregistrement impossible, réessaie.'}</p>}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={submit} disabled={save.isPending || !validDuration || (activity.requiresRpe && rpe === null)}>
            {save.isPending ? 'Enregistrement…' : activity.requiresRpe ? 'Enregistrer' : 'J\'y étais'}
          </Button>
          {/* Annuler repart de la saisie enregistrée ; une activité ajoutée mais pas encore déclarée peut être retirée */}
          {log && <Button variant="quiet" onClick={() => { setRpe(log.rpe); setDuration(String(log.duration_min)); setEditing(false) }}>Annuler</Button>}
          {!log && onRemove && <Button variant="quiet" onClick={onRemove}>Retirer</Button>}
        </div>
        {/* Activité prévue avec RPE : dire qu'on ne l'a pas faite plutôt que la laisser vide (sinon comptée comme un oubli) */}
        {!log && activity.plannedSessionId && activity.requiresRpe && (
          <Button variant="quiet" className="self-start" onClick={() => setSkipping(true)}>Je n'ai pas fait</Button>
        )}
      </div>
    </li>
  )
}

function SkipForm({ playerId, date, activity, onClose }: { playerId: string; date: string; activity: DayActivity; onClose: () => void }) {
  const save = useSaveSkip(playerId)
  const [reason, setReason] = useState<SkipReason | null>(null)
  const [note, setNote] = useState('')
  const valid = reason !== null && (reason !== 'autre' || note.trim().length > 0)
  return (
    <li className="flex flex-col gap-3 py-3">
      <p className="font-semibold">{activity.name} : pourquoi tu ne l'as pas faite ?</p>
      <fieldset className="flex flex-col gap-2 pl-1">
        <legend className="sr-only">Raison</legend>
        {(Object.keys(SKIP_REASONS) as SkipReason[]).map(r => (
          <label key={r} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${reason === r ? 'border-gold bg-gold/10' : 'border-line'}`}>
            <input type="radio" name={`skip-${activity.activityTypeId}-${date}`} checked={reason === r} onChange={() => setReason(r)} />
            {SKIP_REASONS[r]}
          </label>
        ))}
        {reason === 'autre' && (
          <input type="text" maxLength={200} value={note} onChange={e => setNote(e.target.value)} placeholder="Précise en quelques mots"
            aria-label="Précision" className="rounded-lg bg-field border border-line px-3 py-2 text-base" />
        )}
      </fieldset>
      <OfflineNote shown={save.isPaused} />
      {save.isError && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">{(save.error as { code?: string } | null)?.code === '42501' ? 'Ce jour n\'est plus modifiable, demande au staff.' : 'Enregistrement impossible, réessaie.'}</p>}
      <div className="flex gap-2">
        <Button className="flex-1" disabled={!valid || save.isPending}
          onClick={() => reason && save.mutate({ date, activityTypeId: activity.activityTypeId, reason, note: note.trim() || null }, { onSuccess: onClose })}>
          {save.isPending ? 'Enregistrement…' : 'Valider'}
        </Button>
        <Button variant="quiet" onClick={onClose}>Retour</Button>
      </div>
    </li>
  )
}

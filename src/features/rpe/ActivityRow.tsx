import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { SavedFlash } from '../../components/ui/SavedFlash'
import { useSavedFlash } from '../../components/ui/useSavedFlash'
import { type DayActivity } from './activities'
import { RpePicker } from './RpePicker'
import { useSaveLog } from './useRpe'

type Log = { duration_min: number; rpe: number | null; srpe: number | null; validated_at: string | null }

export function ActivityRow({ playerId, date, activity, log, onRemove }: {
  playerId: string; date: string; activity: DayActivity; log?: Log; onRemove?: () => void
}) {
  const save = useSaveLog(playerId)
  const [flash, showFlash] = useSavedFlash()
  const [editing, setEditing] = useState(!log)
  const [rpe, setRpe] = useState<number | null>(log?.rpe ?? null)
  const [duration, setDuration] = useState(String(log?.duration_min ?? activity.durationMin ?? ''))

  const minutes = Number(duration)
  const validDuration = Number.isInteger(minutes) && minutes > 0 && minutes <= 300

  if (log && !editing) {
    return (
      <li className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <div>
          <p className="font-semibold">{activity.name}</p>
          <p className="text-sm text-ink/70">
            {activity.requiresRpe ? `RPE ${log.rpe} · ` : ''}{log.duration_min} min{activity.requiresRpe ? ` · ${log.srpe} UA` : ''}
          </p>
          <SavedFlash shown={flash} />
        </div>
        {/* une séance validée est verrouillée ; sinon modifiable toute la journée */}
        {!log.validated_at && <Button variant="quiet" onClick={() => setEditing(true)}>Modifier</Button>}
      </li>
    )
  }

  const submit = () => save.mutate(
    { date, activityTypeId: activity.activityTypeId, plannedSessionId: activity.plannedSessionId, durationMin: minutes, rpe: activity.requiresRpe ? rpe : null },
    { onSuccess: () => { setEditing(false); showFlash() } },
  )

  return (
    <li className="flex flex-col gap-3 border-t border-line pt-3">
      <p className="font-semibold">{activity.name}</p>
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
      {save.isError && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">Enregistrement impossible, réessaie.</p>}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={submit} disabled={save.isPending || !validDuration || (activity.requiresRpe && rpe === null)}>
          {save.isPending ? 'Enregistrement…' : activity.requiresRpe ? 'Enregistrer' : 'J\'y étais'}
        </Button>
        {/* Annuler repart de la saisie enregistrée ; une activité ajoutée mais pas encore déclarée peut être retirée */}
        {log && <Button variant="quiet" onClick={() => { setRpe(log.rpe); setDuration(String(log.duration_min)); setEditing(false) }}>Annuler</Button>}
        {!log && onRemove && <Button variant="quiet" onClick={onRemove}>Retirer</Button>}
      </div>
    </li>
  )
}

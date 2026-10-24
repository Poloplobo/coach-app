import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ScalePicker } from '../../components/ui/ScalePicker'
import { addDays } from '../../lib/week'
import { RPE_LABELS } from '../rpe/activities'
import { WELLNESS_ITEMS, type WellnessItems } from '../wellness/items'
import type { ActivityType, Player } from './load'
import { useAvailabilityDetail, useSetAvailability, useStaffSaveLog, useStaffSaveWellness } from './useStaff'

const field = 'rounded-lg bg-app border border-line px-3 py-2 text-base'
const Saved = ({ ok, error }: { ok: boolean; error: boolean }) => (
  <>
    {ok && <p role="status" className="rounded-lg border border-ok px-3 py-2 text-sm">Enregistré.</p>}
    {error && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">Enregistrement refusé ou impossible.</p>}
  </>
)

// Admins seulement (bouton masqué pour un coach, et refusé par la base de toute façon)
export function AvailabilityPanel({ player, today }: { player: Player; today: string }) {
  const current = useAvailabilityDetail(player.id)
  const save = useSetAvailability()
  const [note, setNote] = useState('')
  const status = current.data?.status ?? 'apte'
  const toggle = () => save.mutate({ playerId: player.id, status: status === 'blessé' ? 'apte' : 'blessé', since: today, note: note.trim() || null })

  return (
    <Card title="Statut blessé / apte (admin)">
      <p className="text-sm">
        Actuellement : <strong>{status}</strong>{current.data?.since && ` depuis le ${current.data.since}`}
        {current.data?.note && <span className="text-ink/70"> — « {current.data.note} »</span>}
      </p>
      <p className="text-xs text-ink/60">Un joueur blessé ne voit plus les séances du groupe (seulement son programme individuel) et sort des alertes de sous-charge.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm grow">
          Note (facultatif, visible du staff et du joueur)
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="ex. entorse cheville, reprise prévue le…" className={field} />
        </label>
        <Button disabled={save.isPending} onClick={toggle}>{status === 'blessé' ? 'Déclarer apte' : 'Déclarer blessé'}</Button>
      </div>
      <Saved ok={save.isSuccess} error={save.isError} />
    </Card>
  )
}

// Oubli ou erreur d'un joueur : le staff saisit à sa place, sur n'importe quel jour passé (« saisi par le staff »)
export function CorrectionPanel({ player, types, today }: { player: Player; types: ActivityType[]; today: string }) {
  const saveLog = useStaffSaveLog()
  const saveWellness = useStaffSaveWellness()
  const [date, setDate] = useState(addDays(today, -1))
  const [activityId, setActivityId] = useState('')
  const [duration, setDuration] = useState('')
  const [rpe, setRpe] = useState<number | null>(null)
  const [items, setItems] = useState<Partial<WellnessItems>>({})
  const activity = types.find(t => t.id === activityId)
  const minutes = Number(duration)
  const logReady = activity && Number.isInteger(minutes) && minutes > 0 && minutes <= 300 && (!activity.requires_rpe || rpe !== null)
  const wellnessReady = WELLNESS_ITEMS.every(i => items[i.key] !== undefined)

  return (
    <Card title={`Corriger une saisie de ${player.first_name}`}>
      <label className="flex flex-col gap-1 text-sm max-w-xs">
        Jour concerné
        <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className={field} />
      </label>

      <details className="border-t border-line pt-3">
        <summary className="cursor-pointer font-semibold text-sm">Activité (RPE et durée)</summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Activité
              <select value={activityId} onChange={e => setActivityId(e.target.value)} className={field}>
                <option value="">Choisir…</option>
                {[...types].sort((a, b) => a.name.localeCompare(b.name)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Durée (min)
              <input type="number" min={1} max={300} value={duration} onChange={e => setDuration(e.target.value)} className={`${field} w-28`} />
            </label>
          </div>
          {activity?.requires_rpe && (
            <ScalePicker label="RPE" min={0} max={10} low="Repos" high="Maximal" value={rpe} onChange={setRpe} hint={rpe !== null ? RPE_LABELS[rpe] : undefined} />
          )}
          <p className="text-xs text-ink/60">Si le joueur avait déjà déclaré cette activité ce jour-là, sa saisie est remplacée.</p>
          <Button disabled={!logReady || saveLog.isPending} onClick={() => saveLog.mutate({
            playerId: player.id, date, activityTypeId: activityId, durationMin: minutes, rpe: activity?.requires_rpe ? rpe : null,
          })}>Enregistrer l'activité</Button>
          <Saved ok={saveLog.isSuccess} error={saveLog.isError} />
        </div>
      </details>

      <details className="border-t border-line pt-3">
        <summary className="cursor-pointer font-semibold text-sm">État de forme</summary>
        <div className="mt-3 flex flex-col gap-3">
          {WELLNESS_ITEMS.map(i => (
            <ScalePicker key={i.key} label={i.label} min={1} max={5} low={i.low} high={i.high}
              value={items[i.key] ?? null} onChange={v => setItems({ ...items, [i.key]: v })} />
          ))}
          <Button disabled={!wellnessReady || saveWellness.isPending}
            onClick={() => saveWellness.mutate({ playerId: player.id, date, items: items as WellnessItems })}>
            Enregistrer l'état de forme
          </Button>
          <Saved ok={saveWellness.isSuccess} error={saveWellness.isError} />
        </div>
      </details>
    </Card>
  )
}

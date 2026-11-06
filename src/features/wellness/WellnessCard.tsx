import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ScalePicker } from '../../components/ui/ScalePicker'
import { OfflineNote } from '../../components/ui/OfflineNote'
import { SavedFlash } from '../../components/ui/SavedFlash'
import { useSavedFlash } from '../../components/ui/useSavedFlash'
import { FatigueBody } from './FatigueBody'
import { FatigueTrend } from './FatigueTrend'
import { WELLNESS_ITEMS, useSaveWellness, useWellnessDay, type WellnessItems, type WellnessKey } from './useWellness'
import { Loading } from '../../components/ui/Loading'

export function WellnessCard({ playerId, date }: { playerId: string; date: string }) {
  const today = useWellnessDay(playerId, date)
  const save = useSaveWellness(playerId)
  const [flash, showFlash] = useSavedFlash()
  const [draft, setDraft] = useState<Partial<WellnessItems> | null>(null)

  if (today.isPending) return <Card title="Mon état de forme"><Loading /></Card>
  if (today.isError) {
    // les autres onglets restent verrouillés tant que ce chargement échoue : il faut pouvoir relancer
    return (
      <Card title="Mon état de forme">
        <p>Impossible de charger ton état de forme.</p>
        <Button onClick={() => today.refetch()} disabled={today.isFetching}>{today.isFetching ? 'Chargement…' : 'Réessayer'}</Button>
      </Card>
    )
  }

  const entry = today.data
  if (entry && !draft) {
    return (
      <Card boxed title="Mon état de forme">
        {/* le joueur voit son % de fatigue, pas le score sur 30 (réservé au staff) */}
        {entry.score !== null ? <FatigueBody wellness={entry} score={entry.score} /> : <p>État de forme enregistré.</p>}
        <div className="flex items-center justify-between gap-3">
          <SavedFlash shown={flash} label="État de forme enregistré" />
          <Button variant="ghost" size="sm" onClick={() => setDraft(Object.fromEntries(
            WELLNESS_ITEMS.flatMap(i => entry[i.key] === null ? [] : [[i.key, entry[i.key]]]),
          ))}>
            Modifier
          </Button>
        </div>
        <FatigueTrend playerId={playerId} date={date} />
      </Card>
    )
  }

  const values: Partial<WellnessItems> = draft ?? {}
  const answered = WELLNESS_ITEMS.filter(i => values[i.key] !== undefined).length
  const complete = answered === WELLNESS_ITEMS.length
  const submit = () => save.mutate({ date, items: values as WellnessItems }, { onSuccess: () => { setDraft(null); showFlash() } })

  return (
    <Card boxed title="Mon état de forme" help="6 questions, 5 = meilleur état pour toutes.">
      <div className="flex flex-col gap-4">
        {WELLNESS_ITEMS.map(item => (
          <ScalePicker inline
            key={item.key} label={item.label} min={1} max={5} low={item.low} high={item.high}
            value={values[item.key] ?? null}
            onChange={v => setDraft({ ...values, [item.key as WellnessKey]: v })}
          />
        ))}
      </div>
      <OfflineNote shown={save.isPaused} />
      {save.isError && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">Enregistrement impossible, réessaie.</p>}
      <Button onClick={submit} disabled={!complete || save.isPending}>
        {save.isPending ? 'Enregistrement…' : complete ? 'Enregistrer' : `Réponds aux ${WELLNESS_ITEMS.length} questions (${answered}/${WELLNESS_ITEMS.length})`}
      </Button>
      {entry && <Button variant="quiet" className="self-center" onClick={() => setDraft(null)}>Annuler</Button>}
    </Card>
  )
}

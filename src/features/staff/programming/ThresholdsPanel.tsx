import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Loading } from '../../../components/ui/Loading'
import { OVER_FACTOR, type ActivityType } from '../load'
import { useReference, useSaveThreshold } from '../useStaff'

// Seuil d'UA par activité : au-dessus, la séance est signalée (orange, rouge au-delà de 1,25 × le seuil) dans les vues
// Aujourd'hui et Semaine. Pré-rempli avec le repère de la saison (90 % des séances en dessous).
export function ThresholdsPanel() {
  const ref = useReference()
  if (ref.isPending) return <Loading />
  if (ref.isError) return <p role="alert">Impossible de charger les activités.</p>
  const types = ref.data.types.filter(t => t.requires_rpe)
  return (
    <Card title="Seuils de charge par activité"
      help={`UA max d'une séance (RPE × minutes). Au-dessus : orange ; au-delà de ${OVER_FACTOR.toLocaleString('fr-FR')} × le seuil : rouge. Vide : pas d'alerte. Les activités sans RPE (vidéo, soins) n'ont pas de seuil.`}>
      <ul className="flex flex-col divide-y divide-line">
        {types.map(t => <ThresholdRow key={`${t.id}-${t.max_srpe ?? ''}`} type={t} />)}
      </ul>
    </Card>
  )
}

function ThresholdRow({ type }: { type: ActivityType }) {
  const save = useSaveThreshold()
  const [value, setValue] = useState(type.max_srpe?.toString() ?? '')
  const max = value.trim() === '' ? null : Number(value)
  const valid = max === null || (Number.isInteger(max) && max > 0 && max <= 3000)
  const changed = max !== (type.max_srpe ?? null)
  return (
    <li className="flex flex-wrap items-center gap-3 py-2">
      <label htmlFor={`seuil-${type.id}`} className="min-w-48 flex-1 font-semibold">{type.name}</label>
      <span className="flex items-center gap-2 text-sm">
        <input id={`seuil-${type.id}`} type="number" inputMode="numeric" min={1} max={3000} value={value} placeholder="aucun"
          onChange={e => setValue(e.target.value)} aria-invalid={!valid} className="w-24 rounded-lg bg-field border border-line px-3 py-1.5 text-base" />
        UA
      </span>
      <Button size="sm" variant="ghost" disabled={!valid || !changed || save.isPending} onClick={() => save.mutate({ id: type.id, max })}>
        {save.isPending ? '…' : 'Enregistrer'}
      </Button>
      {!valid && <span role="alert" className="text-xs text-rnr">Nombre entier de 1 à 3000</span>}
      {save.isError && <span role="alert" className="text-xs text-rnr">Non enregistré</span>}
    </li>
  )
}

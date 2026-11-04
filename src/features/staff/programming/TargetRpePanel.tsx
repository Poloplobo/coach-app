import { useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { Loading } from '../../../components/ui/Loading'
import { OVER_FACTOR, formatRange, parseRpeRange, type RpeRange } from '../load'
import { useReference, useTargetRpes } from '../useStaff'
import { useSaveTargetRpe } from './useProgramming'

// RPE visé par activité pour chaque type de semaine, en fourchette d'entiers (« 3-4 » ou « 3,4 » : 3 ou 4). Le seuil de
// charge d'une séance en découle : haut de la fourchette × durée prévue de la séance (0032).
export function TargetRpePanel() {
  const ref = useReference()
  const targets = useTargetRpes()
  if (ref.isPending || targets.isPending) return <Loading />
  if (ref.isError || targets.isError) return <p role="alert">Impossible de charger les RPE visés.</p>
  const types = ref.data.types.filter(t => t.requires_rpe)
  const weekTypes = [...ref.data.weekTypes].sort((a, b) => b.target_srpe - a.target_srpe)
  return (
    <Card title="RPE visés et seuils de charge"
      help={`RPE attendu pour chaque activité selon le type de semaine, en fourchette : « 3-4 » (ou « 3,4 ») = 3 ou 4. Une séance du planning prend cette fourchette, sauf si tu lui en donnes une autre. Seuil de charge d'une séance = haut de la fourchette × durée prévue : au-dessus, la séance est signalée (rouge au-delà de ${OVER_FACTOR.toLocaleString('fr-FR')} × le seuil). Écart de RPE signalé à ±2 de la fourchette.`}>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead className="text-left text-ink/60">
            <tr><th className="py-2 pr-6 font-normal">Activité</th>
              {weekTypes.map(w => <th key={w.code} className="pr-5 font-normal">{w.code}<span className="block text-xs">{w.target_srpe} UA visés</span></th>)}</tr>
          </thead>
          <tbody>
            {types.map(t => (
              <tr key={t.id} className="border-t border-line align-top">
                <td className="py-1.5 pr-6 font-semibold">{t.name}<span className="block text-xs font-normal text-ink/60">{t.default_duration_min ?? 60} min par défaut</span></td>
                {weekTypes.map(w => {
                  const x = targets.data.find(v => v.week_type_code === w.code && v.activity_type_id === t.id)
                  const value = x ? { min: x.rpe_min, max: x.rpe_max } : null
                  return <td key={w.code} className="py-1.5 pr-5"><RangeInput key={`${t.id}-${w.code}-${x?.rpe_min}-${x?.rpe_max}`} weekType={w.code} activityTypeId={t.id}
                    name={t.name} value={value} minutes={t.default_duration_min ?? 60} /></td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function RangeInput({ weekType, activityTypeId, name, value, minutes }: {
  weekType: string; activityTypeId: string; name: string; value: RpeRange | null; minutes: number
}) {
  const save = useSaveTargetRpe()
  const [text, setText] = useState(value ? formatRange(value) : '')
  const range = parseRpeRange(text)
  const valid = range !== 'invalide'
  const same = (a: RpeRange | null, b: RpeRange | null) => a?.min === b?.min && a?.max === b?.max
  return (
    <span className="flex flex-col gap-0.5">
      <input type="text" inputMode="numeric" value={text} placeholder="—" aria-label={`RPE visé ${name} en ${weekType} (ex. 3-4)`} aria-invalid={!valid}
        onChange={e => setText(e.target.value)}
        onBlur={() => { if (valid && !same(range, value)) save.mutate({ weekType, activityTypeId, range }) }}
        className={`w-16 rounded-lg bg-field border px-2 py-1 text-base ${valid ? 'border-line' : 'border-rnr'}`} />
      <span className="text-xs text-ink/60">{valid && range ? `seuil ${range.max * minutes} UA` : valid ? '' : 'ex. 3-4 ou 4'}</span>
      {save.isError && <span role="alert" className="text-xs text-rnr">Non enregistré</span>}
    </span>
  )
}

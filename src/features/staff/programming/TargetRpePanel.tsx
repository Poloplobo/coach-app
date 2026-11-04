import { useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { Loading } from '../../../components/ui/Loading'
import { useReference, useTargetRpes } from '../useStaff'
import { useSaveTargetRpe } from './useProgramming'

// RPE visé par activité pour chaque type de semaine : appliqué à toute séance du planning qui n'a pas le sien.
// Proposition de départ calculée sur la saison pour qu'une semaine type respectée atteigne sa charge visée (0031).
export function TargetRpePanel() {
  const ref = useReference()
  const targets = useTargetRpes()
  if (ref.isPending || targets.isPending) return <Loading />
  if (ref.isError || targets.isError) return <p role="alert">Impossible de charger les RPE visés.</p>
  const types = ref.data.types.filter(t => t.requires_rpe)
  const weekTypes = [...ref.data.weekTypes].sort((a, b) => b.target_srpe - a.target_srpe)
  return (
    <Card title="RPE visés par semaine type"
      help="RPE (CR-10) attendu pour chaque activité selon le type de semaine. Une séance du planning prend ce RPE, sauf si tu lui en donnes un autre. La charge prévue de chaque semaine (Planning du groupe) en découle : RPE visé × minutes.">
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead className="text-left text-ink/60">
            <tr><th className="py-2 pr-6 font-normal">Activité</th>
              {weekTypes.map(w => <th key={w.code} className="pr-4 font-normal">{w.code}<span className="block text-xs">{w.target_srpe} UA visés</span></th>)}</tr>
          </thead>
          <tbody>
            {types.map(t => (
              <tr key={t.id} className="border-t border-line">
                <td className="py-1.5 pr-6 font-semibold">{t.name}</td>
                {weekTypes.map(w => {
                  const value = targets.data.find(x => x.week_type_code === w.code && x.activity_type_id === t.id)?.target_rpe ?? null
                  return <td key={w.code} className="pr-4"><RpeInput key={`${t.id}-${w.code}-${value}`} weekType={w.code} activityTypeId={t.id} name={t.name} value={value} /></td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function RpeInput({ weekType, activityTypeId, name, value }: { weekType: string; activityTypeId: string; name: string; value: number | null }) {
  const save = useSaveTargetRpe()
  const [text, setText] = useState(value?.toString() ?? '')
  const rpe = text.trim() === '' ? null : Number(text.replace(',', '.'))
  const valid = rpe === null || (Number.isFinite(rpe) && rpe >= 0 && rpe <= 10)
  return (
    <span className="flex items-center gap-1">
      <input type="text" inputMode="decimal" value={text} placeholder="—" aria-label={`RPE visé ${name} en ${weekType}`} aria-invalid={!valid}
        onChange={e => setText(e.target.value)}
        onBlur={() => { if (valid && rpe !== value) save.mutate({ weekType, activityTypeId, rpe: rpe === null ? null : Math.round(rpe * 10) / 10 }) }}
        className={`w-14 rounded-lg bg-field border px-2 py-1 text-base ${valid ? 'border-line' : 'border-rnr'}`} />
      {save.isError && <span role="alert" className="text-xs text-rnr">!</span>}
    </span>
  )
}

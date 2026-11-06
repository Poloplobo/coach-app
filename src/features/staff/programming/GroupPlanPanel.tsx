import { useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { Loading } from '../../../components/ui/Loading'
import { ViewSelect } from '../../../components/ui/ViewSelect'
import { addDays, parisDate } from '../../../lib/week'
import { EXERCISE_SESSIONS, MUSCULATION } from '../../rpe/activities'
import { formatRange, parseRpeRange, plannedLoad, rangeMid, weekOf, type RpeRange } from '../load'
import { useAllPlan, useReference, useTargetRpes } from '../useStaff'
import { planByDay } from './programming'
import { useAddGroupActivity, useGroup, useGroupPlan, useRemovePlanned, useSetDuration, useSetPlannedRpe, useWeeksFull } from './useProgramming'

const field = 'rounded-lg bg-field border border-line px-2 py-1.5 text-sm'

// « Mer. 21 » : tient sur une ligne dans les 7 colonnes
const shortDay = (date: string) =>
  new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).replace(/^./, c => c.toUpperCase())

export function GroupPlanPanel() {
  const group = useGroup()
  const weeks = useWeeksFull()
  const ref = useReference()
  const [code, setCode] = useState<string | null>(null)
  const today = parisDate()
  const week = (weeks.data ?? []).find(w => w.code === code) ?? weekOf(weeks.data ?? [], today)
  const plan = useGroupPlan(group.data?.id, week?.start_date ?? '', week ? addDays(week.start_date, 6) : '')
  const allPlan = useAllPlan(week?.start_date ?? '', week ? addDays(week.start_date, 6) : '') // musculation individuelle de la semaine
  const targets = useTargetRpes()

  if (group.isPending || weeks.isPending || ref.isPending || targets.isPending) return <Loading />
  if (group.isError || weeks.isError || ref.isError || plan.isError || targets.isError) return <p>Impossible de charger le planning.</p>
  if (!week) return <p>Crée d'abord une semaine dans l'onglet « Semaines ».</p>
  const wt = ref.data.weekTypes.find(t => t.code === week.week_type_code)
  const typeRange = (activityTypeId: string | null): RpeRange | null => {
    const t = targets.data.find(x => x.week_type_code === week.week_type_code && x.activity_type_id === activityTypeId)
    return t ? { min: t.rpe_min, max: t.rpe_max } : null
  }
  const ownRange = (i: { planned_rpe: number | null; planned_rpe_max: number | null }): RpeRange | null =>
    i.planned_rpe != null ? { min: Number(i.planned_rpe), max: Number(i.planned_rpe_max ?? i.planned_rpe) } : null
  // Charge prévue d'un joueur si les RPE visés sont respectés : activités du groupe + sa musculation (moyenne des joueurs programmés)
  const groupLoad = plannedLoad((plan.data ?? []).map(i => ({ minutes: i.planned_duration_min ?? 0, range: ownRange(i) ?? typeRange(i.activity_type_id) })))
  const muscuType = ref.data.types.find(t => t.name === MUSCULATION)
  const muscu = (allPlan.data ?? []).filter(s => s.player_id && s.activity_type_id === muscuType?.id)
  const muscuPlayers = new Set(muscu.map(s => s.player_id)).size
  const muscuMinutes = muscuPlayers ? Math.round(muscu.reduce((n, s) => n + (s.planned_duration_min ?? muscuType?.default_duration_min ?? 60), 0) / muscuPlayers) : 0
  const muscuLoad = plannedLoad([{ minutes: muscuMinutes, range: typeRange(muscuType?.id ?? null) }])
  const total = groupLoad + muscuLoad

  // La musculation est individuelle : elle se programme joueur par joueur
  // Musculation, réhab, membres sains : individuelles (fiche du joueur), jamais au planning du groupe
  const types = ref.data.types.filter(t => !EXERCISE_SESSIONS.includes(t.name)).sort((a, b) => a.name.localeCompare(b.name))
  const days = planByDay(plan.data ?? [], week.start_date)

  return (
    <Card title="Planning du groupe" help="Les joueurs voient ces activités dans leur onglet Rugby et dans « À venir ». Retirer une activité ne supprime pas les RPE déjà saisis."
      aside={(
        <ViewSelect label="Semaine" value={week.code} onChange={setCode}>
          {weeks.data.map(w => <option key={w.code} value={w.code}>{w.code} · {w.label}{w.is_off ? ' · OFF' : ''}</option>)}
        </ViewSelect>
      )}>
      {wt && !week.is_off && (
        <p className="text-sm">
          Si les RPE visés sont respectés : activités du groupe <strong>{groupLoad} UA</strong>
          {muscuMinutes > 0 && <> + musculation ≈ <strong>{muscuLoad} UA</strong> ({muscuMinutes} min par joueur en moyenne)</>}
          {' '}= <strong className={total < (wt.srpe_min ?? 0) ? 'text-gold' : wt.srpe_max && total > wt.srpe_max ? 'text-rnr' : 'text-ok'}>{total} UA</strong>
          {' '}pour une charge visée de {wt.target_srpe} UA ({wt.code}, plage {wt.srpe_min ?? 0}{wt.srpe_max ? `-${wt.srpe_max}` : '+'}). Hors match du week-end s'il n'est pas au planning.
        </p>
      )}
      {wt && !week.is_off && total > wt.target_srpe * 1.1 && (() => {
        // Au-dessus de la cible de plus de 10 % : deux leviers chiffrés pour y revenir (étape 12d)
        const excess = total - wt.target_srpe
        const muscuRange = typeRange(muscuType?.id ?? null)
        const muscuMin = muscuRange ? Math.min(muscuMinutes, Math.ceil(excess / ((muscuRange.min + muscuRange.max) / 2) / 5) * 5) : 0
        return (
          <p className="rounded-lg border border-gold px-3 py-2 text-sm">
            Pour revenir à {wt.target_srpe} UA ({excess} UA de trop) :
            {muscuMin > 0 && <> retirer environ <strong>{muscuMin} min de musculation</strong> par joueur{muscuMin >= 60 ? ` (≈ ${Math.round(muscuMin / 60)} séance${Math.round(muscuMin / 60) > 1 ? 's' : ''})` : ''}, ou</>}
            {' '}baisser les RPE visés d'environ <strong>{Math.round(100 * excess / total)} %</strong>, ou raccourcir les activités les plus longues.
          </p>
        )
      })()}
      {week.is_off && <p className="rounded-lg border border-gold px-3 py-2 text-sm">{week.code} est une semaine OFF : pas d'entraînement collectif.</p>}
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        {days.map(d => (
          <Card boxed key={d.date} title={shortDay(d.date)}>
            <ul className="flex flex-col gap-2">
              {d.items.map(item => <PlannedItem key={`${item.id}-${item.planned_rpe ?? ''}-${item.planned_rpe_max ?? ''}`} id={item.id} name={item.activity_types?.name ?? '—'} minutes={item.planned_duration_min}
                range={ownRange(item)} typeRange={typeRange(item.activity_type_id)} past={d.date < today} />)}
            </ul>
            {!week.is_off && d.date >= today && <AddActivity groupId={group.data.id} date={d.date} types={types} taken={new Set(d.items.map(i => i.activity_type_id ?? ''))} />}
          </Card>
        ))}
      </div>
    </Card>
  )
}

function PlannedItem({ id, name, minutes, range, typeRange, past }: { id: string; name: string; minutes: number | null; range: RpeRange | null; typeRange: RpeRange | null; past: boolean }) {
  const setDuration = useSetDuration()
  const setRpe = useSetPlannedRpe()
  const remove = useRemovePlanned()
  const [value, setValue] = useState(String(minutes ?? ''))
  const [rpeText, setRpeText] = useState(range ? formatRange(range) : '')
  const n = Number(value)
  const save = () => { if (Number.isInteger(n) && n > 0 && n <= 300 && n !== minutes) setDuration.mutate({ id, minutes: n }) }
  const r = parseRpeRange(rpeText)
  const rpeValid = r !== 'invalide'
  const saveRpe = () => { if (rpeValid && (r?.min !== range?.min || r?.max !== range?.max)) setRpe.mutate({ id, range: r }) }
  const effective = (rpeValid ? r : null) ?? typeRange
  return (
    <li className="flex flex-col gap-1 border-t border-line pt-2 first:border-0 first:pt-0">
      <span className="text-sm font-semibold">{name}</span>
      <span className="flex items-center gap-2 text-sm">
        <input type="number" min={1} max={300} value={value} onChange={e => setValue(e.target.value)} onBlur={save}
          aria-label={`Durée de ${name} (minutes)`} className={`${field} w-16`} disabled={past} /> min
      </span>
      <span className="flex items-center gap-2 text-sm">
        RPE <input type="text" inputMode="decimal" value={rpeText} onChange={e => setRpeText(e.target.value)} onBlur={saveRpe}
          placeholder={typeRange ? formatRange(typeRange) : '—'} aria-label={`RPE visé de ${name}, ex. 3-4${typeRange ? ` (par défaut ${formatRange(typeRange)})` : ''}`}
          aria-invalid={!rpeValid} className={`${field} w-14 ${rpeValid ? '' : 'border-rnr'}`} disabled={past} />
        <span className="text-xs text-ink/60" title="Charge prévue (milieu de la fourchette × durée) et seuil de la séance (haut de la fourchette × durée)">
          {effective && minutes ? `≈ ${Math.round(rangeMid(effective) * minutes)} UA · seuil ${effective.max * minutes}` : ''}{rpeValid && !r && typeRange ? ' (type)' : ''}
        </span>
        {!past && <button type="button" onClick={() => remove.mutate(id)} disabled={remove.isPending}
          className="ml-auto rounded border border-line px-2 py-0.5 text-xs" aria-label={`Retirer ${name}`}>Retirer</button>}
      </span>
      {(setDuration.isError || setRpe.isError || remove.isError) && <span role="alert" className="text-xs text-rnr">Modification impossible.</span>}
    </li>
  )
}

function AddActivity({ groupId, date, types, taken }: {
  groupId: string; date: string; types: { id: string; name: string; default_duration_min?: number | null }[]; taken: Set<string>
}) {
  const add = useAddGroupActivity()
  const available = types.filter(t => !taken.has(t.id))
  if (!available.length) return null
  return (
    <>
      <select value="" className={field} aria-label="Ajouter une activité" disabled={add.isPending} onChange={e => {
        const t = available.find(a => a.id === e.target.value)
        if (t) add.mutate({ groupId, date, activityTypeId: t.id, name: t.name, minutes: t.default_duration_min ?? 60 })
      }}>
        <option value="">+ Ajouter une activité</option>
        {available.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {add.isError && <span role="alert" className="text-xs text-rnr">Ajout impossible.</span>}
    </>
  )
}

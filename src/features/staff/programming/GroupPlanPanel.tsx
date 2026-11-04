import { useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { Loading } from '../../../components/ui/Loading'
import { ViewSelect } from '../../../components/ui/ViewSelect'
import { addDays, parisDate } from '../../../lib/week'
import { MUSCULATION } from '../../rpe/activities'
import { plannedLoad, weekOf } from '../load'
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
  const typeRpe = (activityTypeId: string | null) => targets.data.find(t => t.week_type_code === week.week_type_code && t.activity_type_id === activityTypeId)?.target_rpe ?? null
  const rpeOf = (i: { planned_rpe: number | null; activity_type_id: string | null }) => (i.planned_rpe != null ? Number(i.planned_rpe) : typeRpe(i.activity_type_id))
  // Charge prévue d'un joueur si les RPE visés sont respectés : activités du groupe + sa musculation (moyenne des joueurs programmés)
  const groupLoad = plannedLoad((plan.data ?? []).map(i => ({ minutes: i.planned_duration_min ?? 0, rpe: rpeOf(i) })))
  const muscuType = ref.data.types.find(t => t.name === MUSCULATION)
  const muscu = (allPlan.data ?? []).filter(s => s.player_id && s.activity_type_id === muscuType?.id)
  const muscuPlayers = new Set(muscu.map(s => s.player_id)).size
  const muscuMinutes = muscuPlayers ? Math.round(muscu.reduce((n, s) => n + (s.planned_duration_min ?? muscuType?.default_duration_min ?? 60), 0) / muscuPlayers) : 0
  const muscuLoad = plannedLoad([{ minutes: muscuMinutes, rpe: typeRpe(muscuType?.id ?? null) }])
  const total = groupLoad + muscuLoad

  // La musculation est individuelle : elle se programme joueur par joueur
  const types = ref.data.types.filter(t => t.name !== MUSCULATION).sort((a, b) => a.name.localeCompare(b.name))
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
      {week.is_off && <p className="rounded-lg border border-gold px-3 py-2 text-sm">{week.code} est une semaine OFF : pas d'entraînement collectif.</p>}
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        {days.map(d => (
          <Card boxed key={d.date} title={shortDay(d.date)}>
            <ul className="flex flex-col gap-2">
              {d.items.map(item => <PlannedItem key={`${item.id}-${item.planned_rpe ?? ''}`} id={item.id} name={item.activity_types?.name ?? '—'} minutes={item.planned_duration_min}
                rpe={item.planned_rpe == null ? null : Number(item.planned_rpe)} typeRpe={typeRpe(item.activity_type_id)} past={d.date < today} />)}
            </ul>
            {!week.is_off && d.date >= today && <AddActivity groupId={group.data.id} date={d.date} types={types} taken={new Set(d.items.map(i => i.activity_type_id ?? ''))} />}
          </Card>
        ))}
      </div>
    </Card>
  )
}

function PlannedItem({ id, name, minutes, rpe, typeRpe, past }: { id: string; name: string; minutes: number | null; rpe: number | null; typeRpe: number | null; past: boolean }) {
  const setDuration = useSetDuration()
  const setRpe = useSetPlannedRpe()
  const remove = useRemovePlanned()
  const [value, setValue] = useState(String(minutes ?? ''))
  const [rpeText, setRpeText] = useState(rpe?.toString() ?? '')
  const n = Number(value)
  const save = () => { if (Number.isInteger(n) && n > 0 && n <= 300 && n !== minutes) setDuration.mutate({ id, minutes: n }) }
  const r = rpeText.trim() === '' ? null : Number(rpeText.replace(',', '.'))
  const rpeValid = r === null || (Number.isFinite(r) && r >= 0 && r <= 10)
  const saveRpe = () => { if (rpeValid && r !== rpe) setRpe.mutate({ id, rpe: r === null ? null : Math.round(r * 10) / 10 }) }
  const effective = r ?? typeRpe
  return (
    <li className="flex flex-col gap-1 border-t border-line pt-2 first:border-0 first:pt-0">
      <span className="text-sm font-semibold">{name}</span>
      <span className="flex items-center gap-2 text-sm">
        <input type="number" min={1} max={300} value={value} onChange={e => setValue(e.target.value)} onBlur={save}
          aria-label={`Durée de ${name} (minutes)`} className={`${field} w-16`} disabled={past} /> min
      </span>
      <span className="flex items-center gap-2 text-sm">
        RPE <input type="text" inputMode="decimal" value={rpeText} onChange={e => setRpeText(e.target.value)} onBlur={saveRpe}
          placeholder={typeRpe?.toLocaleString('fr-FR') ?? '—'} aria-label={`RPE visé de ${name}${typeRpe != null ? ` (par défaut ${typeRpe})` : ''}`}
          aria-invalid={!rpeValid} className={`${field} w-12 ${rpeValid ? '' : 'border-rnr'}`} disabled={past} />
        <span className="text-xs text-ink/60">{effective != null && minutes ? `≈ ${Math.round(effective * minutes)} UA` : ''}{r === null && typeRpe != null ? ' (type)' : ''}</span>
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

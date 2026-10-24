import { useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { addDays, formatDay, parisDate } from '../../../lib/week'
import { MUSCULATION } from '../../rpe/activities'
import { weekOf } from '../load'
import { useReference } from '../useStaff'
import { planByDay } from './programming'
import { useAddGroupActivity, useGroup, useGroupPlan, useRemovePlanned, useSetDuration, useWeeksFull } from './useProgramming'

const field = 'rounded-lg bg-app border border-line px-2 py-1.5 text-sm'

export function GroupPlanPanel() {
  const group = useGroup()
  const weeks = useWeeksFull()
  const ref = useReference()
  const [code, setCode] = useState<string | null>(null)
  const today = parisDate()
  const week = (weeks.data ?? []).find(w => w.code === code) ?? weekOf(weeks.data ?? [], today)
  const plan = useGroupPlan(group.data?.id, week?.start_date ?? '', week ? addDays(week.start_date, 6) : '')

  if (group.isPending || weeks.isPending || ref.isPending) return <p className="text-ink/60">Chargement…</p>
  if (group.isError || weeks.isError || ref.isError || plan.isError) return <p>Impossible de charger le planning.</p>
  if (!week) return <p>Crée d'abord une semaine dans l'onglet « Semaines ».</p>

  // La musculation est individuelle : elle se programme joueur par joueur
  const types = ref.data.types.filter(t => t.name !== MUSCULATION).sort((a, b) => a.name.localeCompare(b.name))
  const days = planByDay(plan.data ?? [], week.start_date)

  return (
    <>
      <label className="flex flex-col gap-1 text-sm self-start">
        Semaine
        <select value={week.code} onChange={e => setCode(e.target.value)} className="rounded-lg bg-surface border border-line px-3 py-2">
          {weeks.data.map(w => <option key={w.code} value={w.code}>{w.code} · {w.label} · {w.start_date}{w.is_off ? ' · OFF' : ''}</option>)}
        </select>
      </label>
      {week.is_off && <p className="rounded-lg border border-gold px-3 py-2 text-sm">{week.code} est une semaine OFF : pas d'entraînement collectif.</p>}
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        {days.map(d => (
          <Card key={d.date} title={formatDay(d.date)}>
            <ul className="flex flex-col gap-2">
              {d.items.map(item => <PlannedItem key={item.id} id={item.id} name={item.activity_types?.name ?? '—'} minutes={item.planned_duration_min} past={d.date < today} />)}
            </ul>
            {!week.is_off && d.date >= today && <AddActivity groupId={group.data.id} date={d.date} types={types} taken={new Set(d.items.map(i => i.activity_type_id ?? ''))} />}
          </Card>
        ))}
      </div>
      <p className="text-xs text-ink/60">Les joueurs voient ces activités dans leur onglet Rugby et dans « À venir ». Retirer une activité ne supprime pas les RPE déjà saisis.</p>
    </>
  )
}

function PlannedItem({ id, name, minutes, past }: { id: string; name: string; minutes: number | null; past: boolean }) {
  const setDuration = useSetDuration()
  const remove = useRemovePlanned()
  const [value, setValue] = useState(String(minutes ?? ''))
  const n = Number(value)
  const save = () => { if (Number.isInteger(n) && n > 0 && n <= 300 && n !== minutes) setDuration.mutate({ id, minutes: n }) }
  return (
    <li className="flex flex-col gap-1 border-t border-line pt-2 first:border-0 first:pt-0">
      <span className="text-sm font-semibold">{name}</span>
      <span className="flex items-center gap-2 text-sm">
        <input type="number" min={1} max={300} value={value} onChange={e => setValue(e.target.value)} onBlur={save}
          aria-label={`Durée de ${name} (minutes)`} className={`${field} w-16`} disabled={past} /> min
        {!past && <button type="button" onClick={() => remove.mutate(id)} disabled={remove.isPending}
          className="ml-auto rounded border border-line px-2 py-0.5 text-xs" aria-label={`Retirer ${name}`}>Retirer</button>}
      </span>
      {(setDuration.isError || remove.isError) && <span role="alert" className="text-xs text-rnr">Modification impossible.</span>}
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

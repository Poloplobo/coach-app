import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ConfirmButton } from '../../../components/ui/ConfirmButton'
import { addDays, parisDate } from '../../../lib/week'
import { rangeLabel } from '../load'
import { useReference } from '../useStaff'
import { nextWeek, weekErrors } from './programming'
import { useClearGroupWeek, useGroup, useSaveWeek, useWeeksFull, type WeekForm } from './useProgramming'

const field = 'rounded-lg bg-app border border-line px-3 py-2 text-base'

export function WeeksPanel() {
  const group = useGroup()
  const weeks = useWeeksFull()
  const ref = useReference()
  const [editing, setEditing] = useState<{ form: WeekForm; previousCode?: string } | null>(null)

  if (group.isPending || weeks.isPending || ref.isPending) return <p className="text-ink/60">Chargement…</p>
  if (group.isError || weeks.isError || ref.isError) return <p>Impossible de charger le calendrier.</p>

  const today = parisDate()
  const startNew = () => setEditing({ form: { ...nextWeek(weeks.data, today), label: '', week_type_code: 'DEV', cycle: weeks.data.at(-1)?.cycle ?? '', phase_note: '', is_off: false } })

  return (
    <>
      {editing && <WeekEditor key={editing.previousCode ?? 'new'} groupId={group.data.id} weeks={weeks.data} {...editing}
        weekTypes={ref.data.weekTypes} onDone={() => setEditing(null)} />}
      <Card title="Calendrier de la saison">
        <div className="flex justify-end"><Button onClick={startNew}>Nouvelle semaine</Button></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink/60">
              <tr>{['Code', 'Libellé', 'Lundi', 'Type', 'Cycle', 'Note', ''].map(h => <th key={h} className="py-2 pr-3 font-normal">{h}</th>)}</tr>
            </thead>
            <tbody>
              {[...weeks.data].reverse().map(w => {
                const wt = ref.data.weekTypes.find(t => t.code === w.week_type_code)
                return (
                  <tr key={w.code} className="border-t border-line">
                    <td className="py-2 pr-3 font-semibold">{w.code}{addDays(w.start_date, 6) < today && <span className="text-ink/50"> · passée</span>}</td>
                    <td className="pr-3">{w.label}</td>
                    <td className="pr-3">{w.start_date}</td>
                    <td className="pr-3">{w.is_off ? <Badge tone="neutral">OFF</Badge> : <>{w.week_type_code}{wt && <span className="text-ink/60"> · {rangeLabel(wt)}</span>}</>}</td>
                    <td className="pr-3">{w.cycle}</td>
                    <td className="pr-3 text-ink/70">{w.phase_note}</td>
                    <td>{addDays(w.start_date, 6) >= today && <Button variant="ghost" className="py-1.5" onClick={() => setEditing({
                      previousCode: w.code,
                      form: { code: w.code, label: w.label ?? '', start_date: w.start_date, week_type_code: w.week_type_code, cycle: w.cycle ?? '', phase_note: w.phase_note ?? '', is_off: w.is_off },
                    })}>Modifier</Button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

function WeekEditor({ groupId, weeks, form: initial, previousCode, weekTypes, onDone }: {
  groupId: string; weeks: { code: string; start_date: string; is_off: boolean }[]; form: WeekForm; previousCode?: string
  weekTypes: { code: string; name: string }[]; onDone: () => void
}) {
  const [form, setForm] = useState(initial)
  const save = useSaveWeek()
  const clear = useClearGroupWeek()
  const errors = weekErrors(form, weeks, previousCode)
  const becomesOff = form.is_off && !weeks.find(w => w.code === previousCode)?.is_off
  const set = (patch: Partial<WeekForm>) => setForm({ ...form, ...patch })

  const submit = async () => {
    await save.mutateAsync({ groupId, week: form, previousCode })
    // OFF : pas d'entraînement collectif, les séances de groupe prévues cette semaine sont retirées
    if (becomesOff) await clear.mutateAsync({ groupId, from: [form.start_date, parisDate()].sort()[1], to: addDays(form.start_date, 6) })
    onDone()
  }

  return (
    <Card title={previousCode ? `Modifier ${previousCode}` : 'Nouvelle semaine'}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">Code<input value={form.code} onChange={e => set({ code: e.target.value.toUpperCase() })} className={field} /></label>
        <label className="flex flex-col gap-1 text-sm">Lundi
          {/* une semaine existante garde son lundi : ses séances resteraient sinon aux anciennes dates */}
          <input type="date" value={form.start_date} onChange={e => set({ start_date: e.target.value })} disabled={!!previousCode} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">Libellé<input value={form.label} onChange={e => set({ label: e.target.value })} placeholder="ex. Semaine 9 (Nantes)" className={field} /></label>
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select value={form.week_type_code} onChange={e => set({ week_type_code: e.target.value })} className={field}>
            {weekTypes.map(t => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">Cycle<input value={form.cycle} onChange={e => set({ cycle: e.target.value })} placeholder="ex. Cycle 2" className={field} /></label>
        <label className="flex flex-col gap-1 text-sm">Note / phase<input value={form.phase_note} onChange={e => set({ phase_note: e.target.value })} className={field} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.is_off} onChange={e => set({ is_off: e.target.checked })} className="h-5 w-5" />
        Semaine OFF (pas d'entraînement collectif)
      </label>
      {becomesOff && <p className="rounded-lg border border-gold px-3 py-2 text-sm">Les séances du groupe prévues à partir d'aujourd'hui seront retirées. Les RPE déjà saisis sont conservés.</p>}
      {errors.length > 0 && <ul className="text-sm text-rnr">{errors.map(e => <li key={e}>{e}</li>)}</ul>}
      {(save.isError || clear.isError) && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">Enregistrement impossible, réessaie.</p>}
      <div className="flex gap-2">
        {becomesOff
          ? <ConfirmButton confirmLabel="Confirmer : passer en OFF" disabled={errors.length > 0 || save.isPending} onClick={submit}>Enregistrer</ConfirmButton>
          : <Button disabled={errors.length > 0 || save.isPending} onClick={submit}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button>}
        <Button variant="ghost" onClick={onDone}>Annuler</Button>
      </div>
    </Card>
  )
}

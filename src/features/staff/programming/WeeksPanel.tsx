import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Loading } from '../../../components/ui/Loading'
import { ConfirmButton } from '../../../components/ui/ConfirmButton'
import { addDays, parisDate } from '../../../lib/week'
import { rangeLabel } from '../load'
import { useReference, useStaffMuscu } from '../useStaff'
import { nextWeek, progressedLoads, weekErrors } from './programming'
import { useClearGroupWeek, useDuplicateWeek, useGroup, useSaveWeek, useWeeksFull, type WeekForm } from './useProgramming'

const field = 'rounded-lg bg-app border border-line px-3 py-2 text-base'

export function WeeksPanel() {
  const group = useGroup()
  const weeks = useWeeksFull()
  const ref = useReference()
  const [editing, setEditing] = useState<{ form: WeekForm; previousCode?: string } | null>(null)

  if (group.isPending || weeks.isPending || ref.isPending) return <Loading />
  if (group.isError || weeks.isError || ref.isError) return <p>Impossible de charger le calendrier.</p>

  const today = parisDate()
  const startNew = () => setEditing({ form: { ...nextWeek(weeks.data, today), label: '', week_type_code: 'DEV', cycle: weeks.data.at(-1)?.cycle ?? '', phase_note: '', is_off: false } })

  return (
    <>
      {editing && <WeekEditor key={editing.previousCode ?? 'new'} groupId={group.data.id} weeks={weeks.data} {...editing}
        weekTypes={ref.data.weekTypes} onDone={() => setEditing(null)} />}
      <DuplicateWeek groupId={group.data.id} weeks={weeks.data} today={today} />
      <Card title="Calendrier de la saison" aside={<Button size="sm" onClick={startNew}>Nouvelle semaine</Button>}>
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
                    <td className="pr-3">{new Date(w.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</td>
                    <td className="pr-3">{w.is_off ? <Badge tone="neutral">OFF</Badge> : <>{w.week_type_code}{wt && <span className="text-ink/60"> · {rangeLabel(wt)}</span>}</>}</td>
                    <td className="pr-3">{w.cycle}</td>
                    <td className="pr-3 text-ink/70">{w.phase_note}</td>
                    <td>{addDays(w.start_date, 6) >= today && <Button variant="ghost" size="sm" onClick={() => setEditing({
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

// Copie le planning du groupe et les séances individuelles d'une semaine sur la suivante, charges ajustées selon les retours
function DuplicateWeek({ groupId, weeks, today }: { groupId: string; weeks: { code: string; start_date: string; is_off: boolean }[]; today: string }) {
  // Sources possibles : les semaines suivies d'une semaine du calendrier qui n'est pas encore terminée
  const pairs = weeks.flatMap(w => {
    const next = weeks.find(n => n.start_date === addDays(w.start_date, 7))
    return next && addDays(next.start_date, 6) >= today ? [{ from: w, to: next }] : []
  })
  const [fromCode, setFromCode] = useState(() => ([...pairs].reverse().find(p => p.from.start_date <= today) ?? pairs[0])?.from.code ?? '')
  const pair = pairs.find(p => p.from.code === fromCode) ?? pairs[0]
  const muscu = useStaffMuscu(pair?.from.start_date ?? '', pair ? addDays(pair.from.start_date, 6) : '')
  const duplicate = useDuplicateWeek()

  if (!pair) return (
    <Card title="Dupliquer une semaine">
      <p className="text-sm text-ink/70">Ajoute la semaine suivante au calendrier pour pouvoir y recopier la semaine en cours.</p>
    </Card>
  )
  const loads = muscu.data ? progressedLoads(muscu.data) : {}
  const changes = muscu.data?.flatMap(s => s.planned_exercises).filter(e => e.id in loads) ?? []
  const up = changes.filter(e => loads[e.id] > Number(e.load_value)).length
  const noFeedback = muscu.data?.flatMap(s => s.planned_exercises).filter(e => !e.exercise_feedback[0]?.status).length ?? 0
  // Erreurs levées par duplicate_week (déjà en français) ; sinon problème réseau ou inattendu
  const error = duplicate.error as { code?: string; message?: string } | null
  const errorText = error?.code && /^(P0|42501)/.test(error.code) ? `Duplication impossible : ${error.message}.` : 'Duplication impossible, réessaie.'

  return (
    <Card title="Dupliquer une semaine">
      <p className="text-sm text-ink/70">
        Recopie le planning du groupe et les séances individuelles de ses joueurs (musculation comprise) sur la semaine suivante.
        Charges en kg ou %RM : +2,5 % si validée avec RPE &lt; 5, +1,25 % si validée avec RPE ≥ 5, −2,5 % si non validée avec RPE ≥ 7,
        sinon identiques. Les séances déjà programmées et les jours passés ne sont pas touchés.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Copier
          <select value={pair.from.code} onChange={e => { setFromCode(e.target.value); duplicate.reset() }} className={field}>
            {pairs.map(p => <option key={p.from.code} value={p.from.code}>{p.from.code} → {p.to.code}</option>)}
          </select>
        </label>
        <ConfirmButton size="sm" confirmLabel={`Confirmer : remplir ${pair.to.code}`} disabled={!muscu.data || duplicate.isPending}
          onClick={() => duplicate.mutate({ groupId, from: pair.from.start_date, to: pair.to.start_date, loads })}>
          {duplicate.isPending ? 'Copie…' : `Dupliquer vers ${pair.to.code}`}
        </ConfirmButton>
      </div>
      {muscu.isPending && <Loading />}
      {muscu.isError && <p role="alert" className="text-sm text-rnr">Impossible de lire les séances de {pair.from.code}.</p>}
      {muscu.data && (
        <p className="text-sm">
          {muscu.data.length} séance{muscu.data.length > 1 ? 's' : ''} de musculation · {up} charge{up > 1 ? 's' : ''} en hausse ·{' '}
          {changes.length - up} en baisse · les autres identiques
          {noFeedback > 0 && <span className="block text-ink/70">{noFeedback} exercice{noFeedback > 1 ? 's' : ''} sans retour du joueur : charge reconduite à l'identique.</span>}
          {pair.to.is_off && <span className="block text-ink/70">{pair.to.code} est OFF : le planning du groupe ne sera pas copié.</span>}
        </p>
      )}
      {duplicate.data && (
        <p role="status" className="rounded-lg border border-line px-3 py-2 text-sm">
          {pair.to.code} remplie : {duplicate.data.group} activité{duplicate.data.group > 1 ? 's' : ''} du groupe,{' '}
          {duplicate.data.individual} séance{duplicate.data.individual > 1 ? 's' : ''} individuelle{duplicate.data.individual > 1 ? 's' : ''}
          {duplicate.data.skipped > 0 && ` · non copiées (déjà en place ou jour passé) : ${duplicate.data.skipped}`}.
        </p>
      )}
      {duplicate.isError && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">{errorText}</p>}
    </Card>
  )
}

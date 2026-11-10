import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ConfirmButton } from '../../../components/ui/ConfirmButton'
import { Loading } from '../../../components/ui/Loading'
import { addDays, formatDay, parisDate } from '../../../lib/week'
import { MUSCULATION } from '../../rpe/activities'
import { fullName } from '../load'
import { useReference, useRoster } from '../useStaff'
import { moveRow, newRow, rowsErrors, rowsFromSession, toPayload, type EditRow } from './programming'
import { useCreateExercise, useCreateMuscuSession, useDeleteMuscuSession, useExerciseLibrary, useMuscuSession, useSaveMuscuExercises, useSetFocus } from './useProgramming'

const field = 'rounded-lg bg-field border border-line px-2 py-1.5 text-sm'
const UNITS = [{ v: 'pct_rm', l: '%RM' }, { v: 'kg', l: 'kg' }, { v: 'bw', l: '% PDC' }, { v: 'free', l: 'libre' }]

export function MuscuEditor() {
  const roster = useRoster()
  const today = parisDate()
  const [playerId, setPlayerId] = useState('')
  const [date, setDate] = useState(addDays(today, 1))
  const selected = playerId || roster.data?.[0]?.id || ''
  const session = useMuscuSession(selected, date)

  if (roster.isPending) return <Loading />
  if (roster.isError) return <p>Impossible de charger les joueurs.</p>

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Joueur
          <select value={selected} onChange={e => setPlayerId(e.target.value)} className="rounded-lg bg-field border border-line px-3 py-2">
            {roster.data.map(p => <option key={p.id} value={p.id}>{fullName(p)}{p.injured ? ' (blessé)' : ''}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Jour
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-lg bg-field border border-line px-3 py-2" />
        </label>
      </div>
      {session.isPending && <Loading />}
      {session.isError && <p>Impossible de charger la séance.</p>}
      {session.isSuccess && (
        <SessionEditor key={`${selected}-${date}-${session.data?.id ?? 'none'}`} playerId={selected} date={date}
          past={date < today} session={session.data} />
      )}
    </>
  )
}

function SessionEditor({ playerId, date, past, session }: {
  playerId: string; date: string; past: boolean
  session: Awaited<ReturnType<typeof useMuscuSession>['data']>
}) {
  const ref = useReference()
  const library = useExerciseLibrary()
  const create = useCreateMuscuSession()
  const save = useSaveMuscuExercises()
  const remove = useDeleteMuscuSession()
  const addExercise = useCreateExercise()
  const [rows, setRows] = useState<EditRow[] | null>(null)
  const [newName, setNewName] = useState('')

  if (ref.isPending || library.isPending) return <Loading />
  if (ref.isError || library.isError) return <p>Impossible de charger la bibliothèque d'exercices.</p>

  const title = `Musculation — ${formatDay(date)}`
  if (!session) {
    const muscu = ref.data.types.find(t => t.name === MUSCULATION)
    return (
      <Card title={title}>
        <p className="text-sm text-ink/70">Aucune séance de musculation ce jour-là pour ce joueur.</p>
        {past ? <p className="text-sm text-ink/60">Jour passé : l'historique ne se modifie pas.</p> : (
          <Button disabled={!muscu || create.isPending} onClick={() => muscu && create.mutate({ playerId, date, activityTypeId: muscu.id })}>
            Créer la séance
          </Button>
        )}
        {create.isError && <p role="alert" className="text-sm text-rnr">Création impossible.</p>}
      </Card>
    )
  }

  const byName = new Map(library.data.map(e => [e.name, e.id]))
  const exists = (name: string) => library.data.some(e => e.name.trim().toLowerCase() === name.trim().toLowerCase())
  const current = rows ?? rowsFromSession(session.planned_exercises, byName)
  const set = (i: number, patch: Partial<EditRow>) => setRows(current.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const errors = rowsErrors(current)
  const dirty = rows !== null

  if (past) {
    return (
      <Card title={title}>
        <p className="text-sm text-ink/60">Séance passée : l'historique ne se modifie pas (le joueur a répondu sur cette prescription).</p>
        <ul className="text-sm">{current.map(r => <li key={r.key}>{r.block_label} · {library.data.find(e => e.id === r.exercise_id)?.name} · {r.sets ?? '—'} × {r.reps || '—'}</li>)}</ul>
      </Card>
    )
  }

  return (
    <Card title={title}>
      <FocusInput key={session.focus ?? ''} id={session.id} focus={session.focus} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-ink/60">
            <tr>{['', 'Bloc', 'Exercice', 'Séries', 'Reps', 'Charge', '', 'Tempo', 'Repos', 'Consigne', ''].map((h, i) => <th key={i} className="py-1 pr-2 font-normal">{h}</th>)}</tr>
          </thead>
          <tbody>
            {current.map((r, i) => (
              <tr key={r.key} className="border-t border-line align-top">
                <td className="py-1 pr-1 whitespace-nowrap">
                  <button type="button" aria-label="Monter" onClick={() => setRows(moveRow(current, i, -1))} className="px-1">↑</button>
                  <button type="button" aria-label="Descendre" onClick={() => setRows(moveRow(current, i, 1))} className="px-1">↓</button>
                </td>
                <td className="pr-2"><input value={r.block_label} onChange={e => set(i, { block_label: e.target.value.toUpperCase() })} placeholder="A1" aria-label="Bloc" className={`${field} w-14`} /></td>
                <td className="pr-2">
                  <select value={r.exercise_id} onChange={e => set(i, { exercise_id: e.target.value })} aria-label="Exercice" className={`${field} max-w-48`}
                    disabled={r.hasFeedback} title={r.hasFeedback ? 'Le joueur a déjà répondu sur cet exercice' : undefined}>
                    <option value="">Choisir…</option>
                    {library.data.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </td>
                <td className="pr-2"><input type="number" min={1} value={r.sets ?? ''} onChange={e => set(i, { sets: e.target.value ? Number(e.target.value) : null })} aria-label="Séries" className={`${field} w-14`} /></td>
                <td className="pr-2"><input value={r.reps} onChange={e => set(i, { reps: e.target.value })} placeholder="5, 6/côté, AMRAP" aria-label="Répétitions" className={`${field} w-24`} /></td>
                <td className="pr-1"><input type="number" step="0.5" value={r.load_value ?? ''} disabled={r.load_unit === 'free'}
                  onChange={e => set(i, { load_value: e.target.value ? Number(e.target.value) : null })} aria-label="Charge" className={`${field} w-16`} /></td>
                <td className="pr-2">
                  <select value={r.load_unit} onChange={e => set(i, { load_unit: e.target.value })} aria-label="Unité de charge" className={field}>
                    {UNITS.map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
                  </select>
                </td>
                <td className="pr-2"><input value={r.tempo} onChange={e => set(i, { tempo: e.target.value })} placeholder="4.0.1.0" aria-label="Tempo" className={`${field} w-20`} /></td>
                <td className="pr-2"><input value={r.rest} onChange={e => set(i, { rest: e.target.value })} placeholder="2'" aria-label="Repos" className={`${field} w-14`} /></td>
                <td className="pr-2"><input value={r.instructions} onChange={e => set(i, { instructions: e.target.value })} aria-label="Consigne" className={`${field} w-40`} /></td>
                <td>
                  {/* supprimer effacerait le retour du joueur : la base le refuse aussi */}
                  {r.hasFeedback
                    ? <span className="text-xs text-ink/60">retour du joueur</span>
                    : <button type="button" onClick={() => setRows(current.filter((_, j) => j !== i))} aria-label="Retirer l'exercice" className="rounded border border-line px-2 py-0.5 text-xs">Retirer</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Button variant="ghost" onClick={() => setRows([...current, newRow()])}>+ Ajouter un exercice</Button>
        <label className="flex flex-col gap-1 text-sm">
          Nouvel exercice dans la bibliothèque
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="ex. Hip Thrust" className={field} />
        </label>
        <Button variant="ghost" disabled={!newName.trim() || addExercise.isPending || exists(newName)}
          onClick={() => addExercise.mutate(newName, { onSuccess: e => { setRows([...current, newRow((e as { id: string }).id)]); setNewName('') } })}>
          Créer et ajouter
        </Button>
      </div>
      {newName.trim() && exists(newName) && <p className="text-xs text-ink/60">Cet exercice existe déjà : choisis-le dans la liste.</p>}

      {errors.length > 0 && dirty && <ul className="text-sm text-rnr">{errors.map(e => <li key={e}>{e}</li>)}</ul>}
      {save.isError && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">{(save.error as { message?: string }).message ?? 'Enregistrement impossible.'}</p>}
      {save.isSuccess && !dirty && <p role="status" className="rounded-lg border border-ok px-3 py-2 text-sm">Séance enregistrée : le joueur la voit dans son onglet Séance.</p>}
      <div className="flex gap-2">
        <Button disabled={!dirty || errors.length > 0 || save.isPending}
          onClick={() => save.mutate({ sessionId: session.id, rows: toPayload(current) }, { onSuccess: () => setRows(null) })}>
          {save.isPending ? 'Enregistrement…' : 'Enregistrer la séance'}
        </Button>
        {dirty && <Button variant="ghost" onClick={() => setRows(null)}>Annuler les modifications</Button>}
        {/* Le joueur a répondu : la séance reste (ses retours seraient perdus) ; la base le refuse de toute façon */}
        <ConfirmButton variant="ghost" className="ml-auto" confirmLabel="Confirmer la suppression"
          disabled={remove.isPending || current.some(r => r.hasFeedback)} onClick={() => remove.mutate(session.id)}>
          Supprimer la séance
        </ConfirmButton>
      </div>
      {current.some(r => r.hasFeedback) && <p className="text-xs text-ink/60">Le joueur a déjà répondu à cette séance : elle ne peut pas être supprimée.</p>}
      {remove.isError && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">{(remove.error as { message?: string }).message ?? 'Suppression impossible.'}</p>}
    </Card>
  )
}

// Intitulé vu par le joueur en titre de sa séance (« Puissance BDC »), enregistré en quittant le champ
function FocusInput({ id, focus }: { id: string; focus: string | null }) {
  const save = useSetFocus()
  const [text, setText] = useState(focus ?? '')
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      Intitulé
      <input value={text} maxLength={80} placeholder="ex. Puissance BDC" onChange={e => setText(e.target.value)}
        onBlur={() => text.trim() !== (focus ?? '') && save.mutate({ id, focus: text })}
        className="w-64 rounded-lg border border-line bg-field px-3 py-1.5 text-base" />
      {save.isError && <span role="alert" className="text-xs text-rnr">Non enregistré</span>}
    </label>
  )
}

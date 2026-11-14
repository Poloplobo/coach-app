import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmButton } from '../../components/ui/ConfirmButton'
import { Loading } from '../../components/ui/Loading'
import { formatDay, parisDate } from '../../lib/week'
import { useIsAdmin } from '../staff/useStaff'
import { GoalForm } from './FollowSection'
import { SleepModule } from './SleepModule'
import { NutritionModule } from './NutritionModule'
import { useFeatureQuery } from './feature'
import {
  GOAL_LABEL, OPEN_REQUEST, STATUS_LABEL, useActivateModule, useEnrollments, useFollowPlayers, useGoals, useHandleRequest, useModules,
  useRequestNotes, useRequests, useSaveNotes, useSetGoalStatus, type Enrollment, type Goal, type Request,
} from './useFollow'

const field = 'rounded-lg border border-line bg-field px-3 py-2 text-sm'
const slotLabel = (iso: string) => new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

// Suivi individuel côté staff (étape 14) : demandes d'entretien, activation des modules, objectifs. Admin seul (RLS).
export default function StaffFollowView() {
  const flag = useFeatureQuery()
  const admin = useIsAdmin()
  if (flag.isPending) return <Loading />
  if (flag.data !== true) return <p className="text-sm text-ink/60">Cette page n'est pas disponible.</p>
  if (!admin) return <Card title="Suivi individuel"><p className="text-sm text-ink/75">Le suivi individuel est réservé au responsable du suivi.</p></Card>
  return <Board />
}

function Board() {
  const modules = useModules()
  const players = useFollowPlayers()
  const requests = useRequests()
  const notes = useRequestNotes()
  const enrollments = useEnrollments()
  const goals = useGoals()
  const all = [modules, players, requests, notes, enrollments, goals]
  if (all.some(q => q.isPending)) return <Loading />
  if (all.some(q => q.isError)) return <p role="alert">Impossible de charger le suivi individuel.</p>

  const name = (id: string) => { const p = players.data!.find(x => x.id === id); return p ? `${p.last_name} ${p.first_name}${p.is_test ? ' (test)' : ''}` : '—' }
  const label = (code: string) => modules.data!.find(m => m.code === code)?.label ?? code
  const active = enrollments.data!.filter(e => e.status === 'actif')
  const enrolled = (r: Request) => active.some(e => e.player_id === r.player_id && e.module_code === r.module_code)
  // À traiter : les demandes ouvertes, et les entretiens réalisés dont le module n'est pas encore activé
  const open = requests.data!.filter(r => OPEN_REQUEST.includes(r.status) || (r.status === 'realise' && !enrolled(r)))
  const closed = requests.data!.filter(r => !open.includes(r))

  return (
    <>
      <Card title={`Demandes d'entretien · ${open.length}`}
        help="Choisis un créneau proposé par le joueur, propose-en un autre ou refuse. Une fois l'entretien fait : note-le comme réalisé, garde tes notes (toi seul les lis) et active le module. La demande reste ici tant que le module n'est pas activé.">
        {!open.length && <p className="text-sm text-ink/60">Aucune demande en attente.</p>}
        <ul className="flex flex-col gap-3">
          {open.map(r => <RequestRow key={r.id} request={r} player={name(r.player_id)} module={label(r.module_code)}
            notes={notes.data!.find(n => n.request_id === r.id)?.notes ?? ''}
            enrolled={enrolled(r)} />)}
        </ul>
        {closed.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer py-2 text-ink/60">Demandes traitées · {closed.length}</summary>
            <ul className="flex flex-col gap-1">
              {closed.map(r => <li key={r.id} className="flex flex-wrap items-center gap-2"><span className="font-semibold">{name(r.player_id)}</span>
                <span className="text-ink/60">{label(r.module_code)} · {formatDay(r.created_at.slice(0, 10))}</span><Badge tone={r.status === 'realise' ? 'ok' : 'neutral'}>{STATUS_LABEL[r.status]}</Badge></li>)}
            </ul>
          </details>
        )}
      </Card>

      <Card title={`Joueurs suivis · ${new Set(active.map(e => e.player_id)).size}`}
        help="Un module ne s'ouvre au joueur qu'après son accord, puis un objectif validé. Tu peux poser l'objectif toi-même pendant l'entretien.">
        {!active.length && <p className="text-sm text-ink/60">Aucun module actif pour l'instant.</p>}
        <ul className="grid gap-4 xl:grid-cols-2">
          {active.map(e => <EnrollmentCard key={e.id} enrollment={e} player={name(e.player_id)} module={label(e.module_code)}
            goals={goals.data!.filter(g => g.enrollment_id === e.id)} />)}
        </ul>
      </Card>
    </>
  )
}

function RequestRow({ request: r, player, module, notes, enrolled }: { request: Request; player: string; module: string; notes: string; enrolled: boolean }) {
  const handle = useHandleRequest()
  const saveNotes = useSaveNotes()
  const activate = useActivateModule()
  const [other, setOther] = useState('')
  const [text, setText] = useState(notes)
  const busy = handle.isPending || activate.isPending
  const done = r.status === 'realise'
  const futureOther = !!other && new Date(other) > new Date()
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line/60">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-display text-lg font-semibold">{player}</span>
        <Badge tone="neutral">{module}</Badge>
        <Badge tone={r.status === 'confirme' || done ? 'ok' : 'warn'}>{STATUS_LABEL[r.status]}</Badge>
        <span className="text-xs text-ink/60">demandé le {formatDay(r.created_at.slice(0, 10))}</span>
      </div>
      {r.comment && <p className="border-l-2 border-line pl-3 text-sm italic text-ink/75">« {r.comment} »</p>}

      {done ? <p className="text-sm text-ink/75">Entretien réalisé : il reste à activer le module (ou à refuser).</p>
      : r.status === 'confirme' && r.confirmed_slot ? (
        <p className="text-sm">Entretien prévu <strong>{slotLabel(r.confirmed_slot)}</strong>.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {r.status === 'autre_creneau' && r.proposed_slot && <p className="text-sm text-ink/75">Tu as proposé {slotLabel(r.proposed_slot)} : en attente de sa réponse.</p>}
          <p className="text-xs text-ink/60">Ses disponibilités (clique pour confirmer) :</p>
          <div className="flex flex-wrap gap-2">
            {r.slots.map((s, i) => <Button key={`${s}-${i}`} size="sm" variant="ghost" disabled={busy} onClick={() => handle.mutate({ id: r.id, status: 'confirme', slot: s })}>{slotLabel(s)}</Button>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="datetime-local" value={other} onChange={e => setOther(e.target.value)} aria-label="Autre créneau" className={field} />
            <Button size="sm" variant="ghost" disabled={!futureOther || busy} onClick={() => handle.mutate({ id: r.id, status: 'autre_creneau', slot: new Date(other).toISOString() }, { onSuccess: () => setOther('') })}>Proposer ce créneau</Button>
          </div>
        </div>
      )}

      <label className="flex flex-col gap-1 text-xs text-ink/60">Notes d'entretien (toi seul)
        <textarea rows={2} maxLength={2000} value={text} onChange={e => setText(e.target.value)}
          onBlur={() => text.trim() !== notes && saveNotes.mutate({ requestId: r.id, notes: text })} className={`${field} text-ink`} />
      </label>
      {(handle.isError || activate.isError || saveNotes.isError) && <p role="alert" className="text-sm text-rnr">Action impossible, réessaie.</p>}
      <div className="flex flex-wrap gap-2">
        {!enrolled && <Button size="sm" disabled={busy} onClick={() => activate.mutate({ playerId: r.player_id, module: r.module_code })}>Activer le module {module.toLowerCase()}</Button>}
        {enrolled && <Badge tone="ok">module activé</Badge>}
        {!done && <Button size="sm" variant="ghost" disabled={busy} onClick={() => handle.mutate({ id: r.id, status: 'realise' })}>Entretien réalisé</Button>}
        {!done && <ConfirmButton size="sm" variant="quiet" confirmLabel="Confirmer le refus" disabled={busy} onClick={() => handle.mutate({ id: r.id, status: 'refuse' })}>Refuser</ConfirmButton>}
      </div>
    </li>
  )
}

function EnrollmentCard({ enrollment: e, player, module, goals }: { enrollment: Enrollment; player: string; module: string; goals: Goal[] }) {
  const setStatus = useSetGoalStatus()
  const [adding, setAdding] = useState(false)
  const live = goals.filter(g => ['propose', 'en_cours'].includes(g.status))
  const past = goals.filter(g => !['propose', 'en_cours'].includes(g.status))
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line/60">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-display text-lg font-semibold">{player}</span>
        <Badge tone="neutral">{module}</Badge>
        {e.consented_at ? <Badge tone="ok">accord donné le {formatDay(e.consented_at.slice(0, 10))}</Badge> : <Badge tone="warn">accord du joueur en attente</Badge>}
      </div>
      {!live.length && !adding && <p className="text-sm text-ink/60">Pas d'objectif en cours.</p>}
      {live.map(g => (
        <div key={g.id} className="flex flex-col gap-1.5 rounded-xl bg-field px-3 py-2.5">
          <p className="flex flex-wrap items-baseline gap-x-2"><span className="font-semibold">{g.central}</span><span className="font-display text-lg text-gold">{g.target_label}</span>
            <Badge tone={g.status === 'en_cours' ? 'ok' : 'warn'}>{GOAL_LABEL[g.status]}</Badge></p>
          <p className="text-sm text-ink/75">{g.means.join(' · ')} · pour le {formatDay(g.due_on)}</p>
          <div className="flex flex-wrap gap-2">
            {g.status === 'propose' && <Button size="sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: g.id, status: 'en_cours' })}>Valider l'objectif</Button>}
            {g.status === 'en_cours' && <>
              <Button size="sm" variant="ghost" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: g.id, status: 'atteint' })}>Atteint</Button>
              <Button size="sm" variant="ghost" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: g.id, status: 'non_atteint' })}>Non atteint</Button>
            </>}
            <ConfirmButton size="sm" variant="quiet" confirmLabel="Confirmer l'abandon" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: g.id, status: 'abandonne' })}>Abandonner</ConfirmButton>
          </div>
        </div>
      ))}
      {setStatus.isError && <p role="alert" className="text-sm text-rnr">Action impossible, réessaie.</p>}
      {e.consented_at && (
        <details className="rounded-xl bg-field px-3 py-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">{e.module_code === 'sommeil' ? 'Son sommeil' : 'Son alimentation'}</summary>
          <div className="pt-2">{e.module_code === 'sommeil'
            ? <SleepModule playerId={e.player_id} today={parisDate()} staff />
            : <NutritionModule playerId={e.player_id} today={parisDate()} staff />}</div>
        </details>
      )}
      {adding
        ? <GoalForm enrollment={e} validate onDone={() => setAdding(false)} />
        : !live.some(g => g.status === 'en_cours') && <Button size="sm" variant="ghost" className="self-start" onClick={() => setAdding(true)}>Poser un objectif</Button>}
      {past.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink/60">Historique · {past.length}</summary>
          <ul className="mt-1 flex flex-col gap-1">{past.map(g => <li key={g.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">{g.central} · {g.target_label}</span>
            <Badge tone={g.status === 'atteint' ? 'ok' : 'neutral'}>{GOAL_LABEL[g.status]}</Badge></li>)}</ul>
        </details>
      )}
    </li>
  )
}

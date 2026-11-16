import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmButton } from '../../components/ui/ConfirmButton'
import { Loading } from '../../components/ui/Loading'
import { formatDay } from '../../lib/week'
import {
  GOAL_LABEL, OPEN_REQUEST, useAnswerRequest, useAskInterview, useConsent, useDeleteGoal, useEnrollments, useGoals, useModules, useRequests, useSaveGoal,
  type Enrollment, type Goal, type GoalInput, type Request,
} from './useFollow'
import { SleepModule } from './SleepModule'
import { NutritionModule } from './NutritionModule'

const field = 'rounded-lg border border-line bg-field px-3 py-2.5 text-base'
// Heure de Paris, première lettre en capitale (« Mercredi 18 novembre à 18:00 »)
const slotLabel = (iso: string) => {
  const t = new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  return t[0].toUpperCase() + t.slice(1)
}
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5)

// Onglet « Suivi » du joueur (étape 14) : pour chaque module, où il en est. Sans module actif, une seule action :
// demander un entretien. Ensuite : consentement, objectif (validé par le staff), puis le module lui-même.
// only : le volet d'un module (sa carte seule) ; except : les modules qui ont leur propre volet (ni carte ici, le reste oui)
export default function FollowSection({ playerId, today, only, except = [] }: { playerId: string; today: string; only?: string; except?: string[] }) {
  const modules = useModules()
  const requests = useRequests(playerId)
  const enrollments = useEnrollments(playerId)
  const goals = useGoals(playerId)
  if (modules.isPending || requests.isPending || enrollments.isPending || goals.isPending) return <Card boxed title="Mon suivi individuel"><Loading /></Card>
  if (modules.isError || requests.isError || enrollments.isError || goals.isError) return <Card boxed title="Mon suivi individuel"><p role="alert" className="text-sm">Impossible de charger ton suivi. Vérifie ta connexion, puis rouvre l'onglet.</p></Card>

  const active = enrollments.data.filter(e => e.status === 'actif')
  const shown = active.filter(e => (only ? e.module_code === only : !except.includes(e.module_code)))
  const open = requests.data.filter(r => OPEN_REQUEST.includes(r.status))
  const free = modules.data.filter(m => !active.some(e => e.module_code === m.code) && !open.some(r => r.module_code === m.code))
  const label = (code: string) => modules.data.find(m => m.code === code)?.label ?? code
  // Dernière demande refusée d'un module encore libre : le joueur doit savoir pourquoi il revoit « Demander un entretien »
  const refused = requests.data.find(r => r.status === 'refuse' && free.some(m => m.code === r.module_code))

  return (
    <>
      {shown.map(e => <ModuleCard key={e.id} enrollment={e} title={label(e.module_code)} today={today}
        goals={goals.data.filter(g => g.enrollment_id === e.id)} />)}
      {!only && open.map(r => <RequestCard key={r.id} request={r} title={label(r.module_code)} />)}
      {/* key : le formulaire repart à zéro quand la liste des sujets change (sinon l'ancien sujet restait choisi) */}
      {!only && free.length > 0 && <AskInterview key={free.map(m => m.code).join()} playerId={playerId} modules={free} first={!active.length && !open.length}
        refused={refused ? label(refused.module_code) : undefined} />}
    </>
  )
}

// Demande d'entretien : le sujet, un ou plusieurs créneaux, un mot facultatif
function AskInterview({ playerId, modules, first, refused }: { playerId: string; modules: { code: string; label: string }[]; first: boolean; refused?: string }) {
  const ask = useAskInterview(playerId)
  const [openForm, setOpenForm] = useState(false)
  const [module, setModule] = useState(modules[0].code)
  const [slots, setSlots] = useState([''])
  const [comment, setComment] = useState('')
  const filled = [...new Set(slots.filter(Boolean))] // pas deux fois le même créneau
  const future = filled.every(s => new Date(s) > new Date())

  if (!openForm) return (
    <Card boxed title={first ? 'Mon suivi individuel' : 'Un autre suivi ?'}
      help={first ? `Un suivi personnalisé avec le staff (${modules.map(m => m.label.toLowerCase()).join(', ')}), qui commence par un entretien.` : `Tu peux aussi demander un entretien : ${modules.map(m => m.label.toLowerCase()).join(', ')}.`}>
      {refused && <p className="rounded-lg bg-field px-3 py-2.5 text-sm text-ink/75">Ta dernière demande d'entretien {refused.toLowerCase()} n'a pas été retenue. Parles-en au staff, ou refais une demande.</p>}
      <Button onClick={() => setOpenForm(true)}>Demander un entretien</Button>
    </Card>
  )
  return (
    <Card boxed title="Demander un entretien">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Sujet</legend>
        <div className="flex flex-wrap gap-2">
          {modules.map(m => (
            <label key={m.code} className={`flex min-h-11 flex-1 items-center justify-center rounded-lg border px-3 font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold ${module === m.code ? 'border-ink bg-ink text-app' : 'border-line'}`}>
              <input type="radio" name="follow-module" className="sr-only" checked={module === m.code} onChange={() => setModule(m.code)} />{m.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Mes disponibilités</legend>
        {slots.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="datetime-local" value={s} aria-label={`Créneau ${i + 1}`} onChange={e => setSlots(slots.map((x, j) => (j === i ? e.target.value : x)))} className={`${field} min-w-0 flex-1`} />
            {slots.length > 1 && <button type="button" aria-label={`Retirer le créneau ${i + 1}`} onClick={() => setSlots(slots.filter((_, j) => j !== i))}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-field text-ink/60"><X size={18} aria-hidden="true" /></button>}
          </div>
        ))}
        {slots.length < 5 && <button type="button" onClick={() => setSlots([...slots, ''])} className="flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-gold"><Plus size={16} aria-hidden="true" />Ajouter un créneau</button>}
        {filled.length > 0 && !future && <p role="alert" className="text-sm text-rnr">Un créneau est déjà passé.</p>}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-semibold">Un mot pour le staff (facultatif)
        <textarea rows={3} maxLength={500} value={comment} onChange={e => setComment(e.target.value)} placeholder="Je veux un entretien sur…" className={`${field} font-normal`} />
      </label>
      {ask.isError && <p role="alert" className="rounded-lg bg-rnr/15 px-3 py-2 text-sm ring-1 ring-rnr/50">Demande non envoyée, réessaie.</p>}
      <div className="flex gap-2">
        <Button className="flex-1" disabled={!filled.length || !future || ask.isPending}
          onClick={() => ask.mutate({ module, slots: filled.map(s => new Date(s).toISOString()), comment }, { onSuccess: () => { setOpenForm(false); setSlots(['']); setComment('') } })}>
          {ask.isPending ? 'Envoi…' : 'Envoyer ma demande'}
        </Button>
        <Button variant="ghost" onClick={() => setOpenForm(false)}>Annuler</Button>
      </div>
    </Card>
  )
}

// Demande en cours : en attente, créneau confirmé, ou autre créneau proposé par le staff
function RequestCard({ request: r, title }: { request: Request; title: string }) {
  const answer = useAnswerRequest()
  return (
    <Card boxed title={`Entretien ${title.toLowerCase()}`}>
      {r.status === 'en_attente' && <>
        <p className="text-sm"><Badge tone="warn">en attente</Badge> <span className="text-ink/75">Le staff va choisir un créneau parmi :</span></p>
        <ul className="list-disc pl-5 text-sm">{r.slots.map((s, i) => <li key={`${s}-${i}`}>{slotLabel(s)}</li>)}</ul>
      </>}
      {r.status === 'confirme' && r.confirmed_slot && (
        <p className="rounded-xl bg-ok/10 px-4 py-3 ring-1 ring-ok/30"><span className="block text-xs text-ink/60">Entretien confirmé</span>
          <span className="font-display text-xl font-semibold">{slotLabel(r.confirmed_slot)}</span></p>
      )}
      {r.status === 'autre_creneau' && r.proposed_slot && <>
        <p className="rounded-xl bg-gold/10 px-4 py-3 ring-1 ring-gold/40"><span className="block text-xs text-ink/60">Le staff te propose</span>
          <span className="font-display text-xl font-semibold">{slotLabel(r.proposed_slot)}</span></p>
        <Button disabled={answer.isPending} onClick={() => answer.mutate({ id: r.id, accept: true })}>Ça me va</Button>
      </>}
      {answer.isError && <p role="alert" className="text-sm text-rnr">Action impossible, réessaie.</p>}
      <ConfirmButton variant="quiet" className="self-start" confirmLabel="Confirmer l'annulation" disabled={answer.isPending}
        onClick={() => answer.mutate({ id: r.id, accept: false })}>Annuler ma demande</ConfirmButton>
    </Card>
  )
}

// Module actif : consentement, puis objectif, puis le module (sommeil ou nutrition)
function ModuleCard({ enrollment: e, title, goals, today }: { enrollment: Enrollment; title: string; goals: Goal[]; today: string }) {
  const consent = useConsent()
  const [agreed, setAgreed] = useState(false)
  const current = goals.find(g => g.status === 'en_cours')
  const proposed = goals.find(g => g.status === 'propose')
  const past = goals.filter(g => ['atteint', 'non_atteint', 'abandonne'].includes(g.status))

  if (!e.consented_at) return (
    <Card boxed title={`Mon suivi ${title.toLowerCase()}`}>
      <p className="text-sm text-ink/75">
        Ton suivi {title.toLowerCase()} est ouvert. Ce que tu y saisis est une donnée de santé : seul le responsable du suivi au Pôle y a accès,
        pour t'accompagner vers ton objectif. Tu peux demander l'arrêt du suivi à tout moment ; tes saisies sont alors supprimées.
      </p>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input type="checkbox" checked={agreed} onChange={ev => setAgreed(ev.target.checked)} className="h-5 w-5 shrink-0" />J'ai compris et je suis d'accord
      </label>
      {consent.isError && <p role="alert" className="text-sm text-rnr">Enregistrement impossible, réessaie.</p>}
      <Button disabled={!agreed || consent.isPending} onClick={() => consent.mutate(e.module_code)}>Commencer mon suivi</Button>
    </Card>
  )
  return (
    <Card boxed title={`Mon suivi ${title.toLowerCase()}`}>
      {current ? <GoalSummary goal={current} today={today} />
        : proposed ? <ProposedGoal goal={proposed} enrollment={e} />
          : <GoalForm enrollment={e} intro="Avant de commencer, fixe ton objectif. Le staff le valide avec toi." />}
      {current && (e.module_code === 'sommeil'
        ? <div className="border-t border-line/60 pt-3"><SleepModule playerId={e.player_id} today={today} /></div>
        : <div className="border-t border-line/60 pt-3"><NutritionModule playerId={e.player_id} today={today} /></div>)}
      {past.length > 0 && (
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-2.5 text-ink/60">Mes objectifs passés · {past.length}</summary>
          <ul className="flex flex-col gap-1.5">
            {past.map(g => <li key={g.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">{g.central}</span>
              <Badge tone={g.status === 'atteint' ? 'ok' : 'neutral'}>{GOAL_LABEL[g.status]}</Badge></li>)}
          </ul>
        </details>
      )}
    </Card>
  )
}

// Objectif en cours : la cible en grand, le temps qu'il reste, les moyens d'action
function GoalSummary({ goal: g, today }: { goal: Goal; today: string }) {
  const total = Math.max(1, daysBetween(g.created_at.slice(0, 10), g.due_on))
  const left = daysBetween(today, g.due_on)
  const elapsed = Math.min(100, Math.max(0, Math.round((100 * (total - left)) / total)))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">Mon objectif</p>
          <p className="font-semibold leading-snug">{g.central}</p>
        </div>
        <p className="shrink-0 text-right"><span className="block font-display text-3xl font-semibold leading-none text-gold">{g.target_label}</span>
          <span className="text-xs text-ink/60">{left > 0 ? `encore ${left} jour${left > 1 ? 's' : ''}` : left === 0 ? 'c\'est aujourd\'hui' : `échéance passée (${formatDay(g.due_on)})`}</span></p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-field" role="img" aria-label={`${elapsed} % du temps écoulé avant le ${formatDay(g.due_on)}`}>
        <span className="block h-full rounded-full bg-gold" style={{ width: `${Math.max(2, elapsed)}%` }} />
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {g.means.map((m, i) => <li key={`${m}-${i}`} className="flex items-start gap-2"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />{m}</li>)}
      </ul>
    </div>
  )
}

function ProposedGoal({ goal: g, enrollment }: { goal: Goal; enrollment: Enrollment }) {
  const remove = useDeleteGoal()
  const [editing, setEditing] = useState(false)
  if (editing) return <GoalForm enrollment={enrollment} goal={g} onDone={() => setEditing(false)} />
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm"><Badge tone="warn">à valider par le staff</Badge></p>
      <p className="font-semibold">{g.central} <span className="font-display text-xl text-gold">· {g.target_label}</span></p>
      <p className="text-sm text-ink/75">{g.means.join(' · ')} · pour le {formatDay(g.due_on)}</p>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Modifier</Button>
        <ConfirmButton variant="quiet" confirmLabel="Confirmer" disabled={remove.isPending} onClick={() => remove.mutate(g.id)}>Supprimer</ConfirmButton>
      </div>
    </div>
  )
}

// Objectif : central, moyens d'action (un par ligne), cible chiffrée, date de fin. Sert au joueur (proposition) et à l'admin.
export function GoalForm({ enrollment, goal, intro, validate = false, onDone }: {
  enrollment: Pick<Enrollment, 'id' | 'player_id'>; goal?: Goal; intro?: string; validate?: boolean; onDone?: () => void
}) {
  const save = useSaveGoal()
  const [v, setV] = useState<GoalInput>({ central: goal?.central ?? '', means: goal?.means ?? [''], target_label: goal?.target_label ?? '', due_on: goal?.due_on ?? '' })
  const means = v.means.filter(m => m.trim())
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
  const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 864e5).toISOString().slice(0, 10)
  const my = validate ? '' : 'Mon ' // l'admin remplit le même formulaire : libellés neutres
  const valid = v.central.trim().length >= 3 && means.length > 0 && v.target_label.trim().length > 0 && v.due_on > today
  return (
    <div className="flex flex-col gap-3">
      {intro && <p className="text-sm text-ink/75">{intro}</p>}
      <label className="flex flex-col gap-1 text-sm font-semibold">{my ? 'Mon objectif' : 'Objectif'}
        <input value={v.central} maxLength={200} onChange={e => setV({ ...v, central: e.target.value })} placeholder="Je veux prendre du poids" className={`${field} font-normal`} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{my ? 'Mes moyens d\'action' : 'Moyens d\'action'}</legend>
        {v.means.map((m, i) => (
          <input key={i} value={m} maxLength={120} aria-label={`Moyen d'action ${i + 1}`} placeholder={i === 0 ? 'Passer à 4 repas par jour' : 'Un autre moyen'}
            onChange={e => setV({ ...v, means: v.means.map((x, j) => (j === i ? e.target.value : x)) })} className={field} />
        ))}
        {v.means.length < 6 && <button type="button" onClick={() => setV({ ...v, means: [...v.means, ''] })} className="flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-gold"><Plus size={16} aria-hidden="true" />Ajouter un moyen</button>}
      </fieldset>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">Cible chiffrée
          <input value={v.target_label} maxLength={80} onChange={e => setV({ ...v, target_label: e.target.value })} placeholder="+3 kg" className={`${field} font-normal`} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">Pour le
          <input type="date" value={v.due_on} min={tomorrow} onChange={e => setV({ ...v, due_on: e.target.value })} className={`${field} font-normal`} />
        </label>
      </div>
      {save.isError && <p role="alert" className="rounded-lg bg-rnr/15 px-3 py-2 text-sm ring-1 ring-rnr/50">Objectif non enregistré, réessaie.</p>}
      <div className="flex gap-2">
        <Button className="flex-1" disabled={!valid || save.isPending}
          onClick={() => save.mutate({ ...v, id: goal?.id, enrollmentId: enrollment.id, playerId: enrollment.player_id, validate }, { onSuccess: onDone })}>
          {save.isPending ? 'Enregistrement…' : validate ? 'Enregistrer et valider' : 'Proposer cet objectif'}
        </Button>
        {onDone && <Button variant="ghost" onClick={onDone}>Annuler</Button>}
      </div>
    </div>
  )
}

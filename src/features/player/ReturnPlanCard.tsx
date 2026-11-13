import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatDay } from '../../lib/week'
import { planProgress } from '../staff/medical'
import { PlanTimeline, StepDays } from '../staff/PlanTimeline'
import { useReturnPlan } from './useReturnPlan'

// Joueur blessé, en tête de l'accueil pendant toute sa réhab : où il en est (étape, jours, retour visé), ce qu'il fait
// en ce moment et ce qui vient ensuite ; le plan complet se déplie. Données de my_return_plan seulement : objectifs,
// programme et critères ; jamais de diagnostic, d'actions kiné ni de commentaire du staff. Pas de plan : rien.
export function ReturnPlanCard({ today }: { today: string }) {
  const plan = useReturnPlan()
  const [all, setAll] = useState(false)
  if (!plan.data?.length) return null
  const occurredOn = plan.data[0].occurred_on
  const p = planProgress(plan.data, occurredOn, today)
  const next = p.current ? p.ordered[p.index + 1] : undefined
  const c = p.current

  return (
    <section aria-label="Mon retour" className="flex flex-col gap-4 rounded-2xl bg-surface p-5 ring-1 ring-gold/40">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold leading-tight">Mon retour</h2>
          <p className="text-sm text-ink/60">{c ? <>Retour visé le <strong className="text-ink">{formatDay(p.returnDate!)}</strong></> : 'Plan terminé'}</p>
        </div>
        {c && (
          <p className="text-right font-display leading-none">
            <span className="text-3xl font-semibold tabular-nums">≈ {p.remainingDays}</span>
            <span className="block text-xs font-sans text-ink/60">jour{p.remainingDays > 1 ? 's' : ''} restant{p.remainingDays > 1 ? 's' : ''}</span>
          </p>
        )}
      </header>

      {/* Une case par étape : vert passée, or en cours, gris à venir */}
      <div className="flex flex-col gap-1.5">
        <ol aria-label={`Étape ${Math.min(p.index + 1, p.total)} sur ${p.total}`} className="flex gap-1">
          {p.ordered.map(s => (
            <li key={s.id} className={`h-2 flex-1 rounded-full ${s.validated_on ? 'bg-ok' : s.id === c?.id ? 'bg-gold' : 'bg-field'}`} />
          ))}
        </ol>
        <p className="text-xs text-ink/60">{c ? `Étape ${p.index + 1} sur ${p.total}` : `${p.total} étapes validées`} · {p.done} validée{p.done > 1 ? 's' : ''}</p>
      </div>

      {c ? (
        <div className="flex flex-col gap-2 rounded-xl bg-gold/10 px-4 py-3 ring-1 ring-gold/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">En ce moment{c.phase ? ` · ${c.phase}` : ''}</p>
          <p className="font-display text-lg font-semibold leading-tight">{c.title}</p>
          <StepDays p={p} occurredOn={occurredOn} today={today} />
          {c.objectives && <p className="text-sm"><span className="text-ink/60">Objectif : </span>{c.objectives}</p>}
          {c.prepa_actions && <p className="text-sm"><span className="text-ink/60">Au programme : </span>{c.prepa_actions}</p>}
          {c.criteria && <p className="rounded-lg bg-surface/60 px-3 py-2 text-sm"><span className="font-semibold">Pour passer à la suite : </span>{c.criteria}</p>}
        </div>
      ) : <p className="text-sm font-semibold text-ok">Toutes les étapes sont validées : le staff va te remettre dans le groupe.</p>}

      {next && (
        <p className="flex items-center gap-2 text-sm text-ink/70">
          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full border-2 border-line" />
          Ensuite : <strong className="text-ink">{next.title}</strong>{next.planned_days > 0 && <span className="text-ink/60">· {next.planned_days} j</span>}
        </p>
      )}

      <button type="button" onClick={() => setAll(!all)} aria-expanded={all}
        className="flex items-center justify-between rounded-lg border-t border-line/60 pt-3 text-sm font-semibold text-gold">
        {all ? 'Masquer le plan' : 'Voir tout mon plan'}<ChevronDown size={18} aria-hidden="true" className={`transition-transform ${all ? 'rotate-180' : ''}`} />
      </button>
      {all && <PlanTimeline p={p} occurredOn={occurredOn} today={today} audience="joueur" />}
      <p className="text-xs text-ink/60">Temps théorique, préparé et validé étape par étape par le staff : il dépend de tes sensations et des critères de chaque étape.</p>
    </section>
  )
}

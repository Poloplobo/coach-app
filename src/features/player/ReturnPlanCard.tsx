import { Card } from '../../components/ui/Card'
import { formatDay } from '../../lib/week'
import { planProgress } from '../staff/medical'
import { useReturnPlan } from './useReturnPlan'

// Joueur blessé : où il en est de son retour (étape en cours, critères, étapes restantes, temps théorique)
export function ReturnPlanCard({ today }: { today: string }) {
  const plan = useReturnPlan()
  if (!plan.data?.length) return null
  const p = planProgress(plan.data, plan.data[0].occurred_on, today)
  return (
    <Card title="Mon retour" help="Ton plan de retour, préparé et validé étape par étape par le staff. Le temps restant est théorique : il dépend de tes sensations et des critères de chaque étape.">
      {p.current ? (
        <p className="text-sm">
          Étape <strong>{p.done + 1} sur {p.total}</strong> : <strong>{p.current.title}</strong>
          <span className="block text-ink/70">Encore environ <strong className="text-ink">{p.remainingDays} jour{p.remainingDays > 1 ? 's' : ''}</strong>
            {p.returnDate && <> · retour visé le <strong className="text-ink">{formatDay(p.returnDate)}</strong></>}</span>
          {p.current.criteria && <span className="mt-1 block rounded-lg bg-field px-3 py-2">Pour valider cette étape : {p.current.criteria}</span>}
        </p>
      ) : <p className="text-sm font-semibold text-ok">Toutes les étapes sont validées : le staff va te remettre dans le groupe.</p>}
      <ol className="flex flex-col gap-1 text-sm">
        {p.ordered.map(s => (
          <li key={s.id} className={`flex items-center gap-2 ${s.validated_on ? 'text-ok' : p.current?.id === s.id ? 'font-semibold' : 'text-ink/60'}`}>
            <span aria-hidden="true" className="w-5 text-center">{s.validated_on ? '✓' : p.current?.id === s.id ? '●' : '○'}</span>
            <span className="flex-1">{s.title}</span>
            <span className="text-xs">{s.validated_on ? `validée le ${formatDay(s.validated_on)}` : `${s.planned_days} j`}</span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

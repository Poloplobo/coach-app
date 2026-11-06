import { Card } from '../../components/ui/Card'
import { formatDay } from '../../lib/week'
import { byPhase, planProgress } from '../staff/medical'
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
          Étape <strong>{p.index + 1} sur {p.total}</strong> : <strong>{p.current.title}</strong>
          <span className="block text-ink/70">Encore environ <strong className="text-ink">{p.remainingDays} jour{p.remainingDays > 1 ? 's' : ''}</strong>
            {p.returnDate && <> · retour visé le <strong className="text-ink">{formatDay(p.returnDate)}</strong></>}</span>
          {p.current.criteria && <span className="mt-1 block rounded-lg bg-field px-3 py-2">Pour valider cette étape : {p.current.criteria}</span>}
        </p>
      ) : <p className="text-sm font-semibold text-ok">Toutes les étapes sont validées : le staff va te remettre dans le groupe.</p>}
      {byPhase(p.ordered).map((g, gi) => {
        const currentPhase = g.steps.some(s => s.id === p.current?.id)
        return (
          <details key={`${g.phase}-${gi}`} open={currentPhase || !g.phase} className="group">
            {g.phase && <summary className="cursor-pointer list-none text-sm font-semibold">
              {g.steps.every(s => s.validated_on) ? '✓ ' : currentPhase ? '● ' : '○ '}{g.phase}{g.days != null && <span className="font-normal text-ink/60"> · {g.days} jours</span>}
            </summary>}
            <ol className="mt-1 flex flex-col gap-1.5 text-sm">
              {g.steps.map(s => (
                <li key={s.id} className={s.validated_on ? 'text-ok' : p.current?.id === s.id ? '' : 'text-ink/70'}>
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="w-5 text-center">{s.validated_on ? '✓' : p.current?.id === s.id || s.in_progress ? '●' : '○'}</span>
                    <span className={`flex-1 ${p.current?.id === s.id ? 'font-semibold' : ''}`}>{s.title}{s.is_test && <span className="text-xs text-gold"> · test</span>}</span>
                    <span className="text-xs">{s.validated_on ? `validée le ${formatDay(s.validated_on)}` : ''}</span>
                  </span>
                  {!s.validated_on && (s.objectives || s.prepa_actions) && (
                    <span className="ml-7 block text-xs text-ink/70">{s.objectives}{s.objectives && s.prepa_actions ? ' · ' : ''}{s.prepa_actions && <>En salle / terrain : {s.prepa_actions}</>}</span>
                  )}
                </li>
              ))}
            </ol>
          </details>
        )
      })}
    </Card>
  )
}

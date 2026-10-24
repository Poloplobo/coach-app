import { Card } from '../../components/ui/Card'
import { latestByTest, progressPct, seasonOf } from './progress'
import { useTargets, useTestResults } from './useTests'
import { Loading } from '../../components/ui/Loading'

const number = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

export function MyGoals({ playerId, date }: { playerId: string; date: string }) {
  const results = useTestResults(playerId)
  const targets = useTargets(playerId, seasonOf(date))

  if (results.isPending || targets.isPending) return <Card title="Mes objectifs"><Loading /></Card>
  if (results.isError || targets.isError) return <Card title="Mes objectifs"><p>Impossible de charger tes tests.</p></Card>

  const latest = latestByTest(results.data)
  const targeted = new Set(targets.data.map(t => t.test_id))
  const otherTests = [...latest.values()].filter(r => !targeted.has(r.test_id))

  if (!targets.data.length && !otherTests.length) {
    return <Card title="Mes objectifs"><p className="text-sm text-ink/70">Pas encore de test ni d'objectif enregistré.</p></Card>
  }

  return (
    <Card title="Mes objectifs">
      <ul className="flex flex-col gap-4">
        {targets.data.map(t => {
          const last = latest.get(t.test_id)
          const pct = last ? progressPct(Number(last.value), Number(t.target_value), t.test_definitions.higher_is_better) : 0
          return (
            <li key={t.test_id} className="flex flex-col gap-1">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{t.test_definitions.name}</span>
                <span className="text-ink/70">
                  {last ? `${number(Number(last.value))} ${t.test_definitions.unit}` : '—'} / {t.label ?? `${number(Number(t.target_value))} ${t.test_definitions.unit}`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-app" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                aria-label={`${t.test_definitions.name} : ${pct} % de l'objectif`}>
                <div className={`h-2 rounded-full ${pct >= 100 ? 'bg-ok' : 'bg-gold'}`} style={{ width: `${pct}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
      {otherTests.length > 0 && (
        <>
          <h3 className="text-sm font-semibold border-t border-line pt-3">Mes derniers tests</h3>
          <ul className="text-sm flex flex-col gap-1">
            {otherTests.map(r => (
              <li key={r.test_id} className="flex justify-between">
                <span>{r.test_definitions.name}</span>
                <span className="text-ink/70">{number(Number(r.value))} {r.test_definitions.unit}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

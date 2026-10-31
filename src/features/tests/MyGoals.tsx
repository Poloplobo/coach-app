import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { movementIcon } from './movementIcon'
import { latestByTest, progressPct, seasonOf } from './progress'
import { useTargets, useTestResults } from './useTests'
import { Loading } from '../../components/ui/Loading'

const number = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

// title : « Mes objectifs » côté joueur, un titre neutre côté staff
export function MyGoals({ playerId, date, title = 'Mes objectifs' }: { playerId: string; date: string; title?: string }) {
  const [view, setView] = useState<'objectifs' | 'tests'>('objectifs')
  const results = useTestResults(playerId)
  const targets = useTargets(playerId, seasonOf(date))

  if (results.isPending || targets.isPending) return <Card title={title}><Loading /></Card>
  if (results.isError || targets.isError) return <Card title={title}><p>Impossible de charger tes tests.</p></Card>

  const latest = latestByTest(results.data)
  const targeted = new Set(targets.data.map(t => t.test_id))
  const otherTests = [...latest.values()].filter(r => !targeted.has(r.test_id))

  if (!targets.data.length && !otherTests.length) {
    return <Card title={title}><p className="text-sm text-ink/70">Pas encore de test ni d'objectif enregistré.</p></Card>
  }

  // objectifs chiffrés d'abord ; les autres tests sur demande (menu) pour garder le bloc court
  const shown = targets.data.length ? view : 'tests'
  return (
    <Card title={title}
      help={shown === 'objectifs' ? 'Barre : dernier test comparé à l\'objectif de la saison.' : undefined}
      aside={targets.data.length > 0 && otherTests.length > 0 && (
        <ViewSelect label="Voir" value={view} onChange={setView}>
          <option value="objectifs">Objectifs</option>
          <option value="tests">Autres tests</option>
        </ViewSelect>
      )}>
      {shown === 'objectifs' && <ul className="flex flex-col gap-3">
        {targets.data.map(t => {
          const last = latest.get(t.test_id)
          const pct = last ? progressPct(Number(last.value), Number(t.target_value), t.test_definitions.higher_is_better) : 0
          const Icon = movementIcon(t.test_definitions.name)
          return (
            <li key={t.test_id} className="flex flex-col gap-1">
              <div className="flex justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 font-semibold"><Icon size={18} aria-hidden="true" className="shrink-0 text-gold" />{t.test_definitions.name}</span>
                <span className="text-ink/70">
                  {last ? `${number(Number(last.value))} ${t.test_definitions.unit}` : '—'} / {t.label ?? `${number(Number(t.target_value))} ${t.test_definitions.unit}`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-field" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                aria-label={`${t.test_definitions.name} : ${pct} % de l'objectif`}>
                <div className={`h-2 rounded-full ${pct >= 100 ? 'bg-ok' : 'bg-gold'}`} style={{ width: `${pct}%` }} />
              </div>
            </li>
          )
        })}
      </ul>}
      {shown === 'tests' && (
        <>
          <ul className="text-sm grid gap-x-6 gap-y-1 sm:grid-cols-2">
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

import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { seasonOf } from '../../tests/progress'
import type { Player } from '../load'
import { useSaveTarget, useSaveTestResult, useTestDefinitions } from './useProgramming'

const field = 'rounded-lg bg-field border border-line px-3 py-2 text-base'
const parse = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

// Le staff saisit les résultats de tests et les objectifs chiffrés ; le joueur les voit dans « Mes objectifs »
export function TestsPanel({ player, today }: { player: Player; today: string }) {
  const defs = useTestDefinitions()
  const saveResult = useSaveTestResult()
  const saveTarget = useSaveTarget()
  const [testId, setTestId] = useState('')
  const [date, setDate] = useState(today)
  const [period, setPeriod] = useState('')
  const [value, setValue] = useState('')
  const [targetTestId, setTargetTestId] = useState('')
  const [target, setTarget] = useState('')
  const [label, setLabel] = useState('')

  if (defs.isPending) return null
  if (defs.isError) return <Card title="Tests et objectifs"><p>Impossible de charger le référentiel des tests.</p></Card>

  const unit = (id: string) => defs.data.find(d => d.id === id)?.unit ?? ''
  const v = parse(value), t = parse(target)
  const validNumber = (n: number | null) => n !== null && Number.isFinite(n) && n > 0
  const options = defs.data.map(d => <option key={d.id} value={d.id}>{d.name} ({d.unit}{d.higher_is_better ? '' : ', plus bas = mieux'})</option>)

  return (
    <Card title={`Tests et objectifs de ${player.first_name}`}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold text-sm">Ajouter un résultat de test</h3>
          <select value={testId} onChange={e => setTestId(e.target.value)} aria-label="Test" className={field}>
            <option value="">Choisir un test…</option>{options}
          </select>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-sm">Date<input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className={field} /></label>
            <label className="flex flex-col gap-1 text-sm">
              Période
              <select value={period} onChange={e => setPeriod(e.target.value)} className={field}>
                <option value="">—</option><option>P1</option><option>P2</option><option>P3</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">Valeur {unit(testId) && `(${unit(testId)})`}
              <input inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} className={`${field} w-28`} />
            </label>
          </div>
          <p className="text-xs text-ink/60">Même test à la même date : le résultat est remplacé.</p>
          <Button disabled={!testId || !date || !validNumber(v) || saveResult.isPending}
            onClick={() => saveResult.mutate({ playerId: player.id, testId, date, period: period || null, value: v! }, { onSuccess: () => setValue('') })}>
            Enregistrer le résultat
          </Button>
          {saveResult.isSuccess && <p role="status" className="text-sm text-ok">Résultat enregistré.</p>}
          {saveResult.isError && <p role="alert" className="text-sm text-rnr">Enregistrement impossible.</p>}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-semibold text-sm">Objectif chiffré de la saison {seasonOf(today)}</h3>
          <select value={targetTestId} onChange={e => setTargetTestId(e.target.value)} aria-label="Test visé" className={field}>
            <option value="">Choisir un test…</option>{options}
          </select>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-sm">Objectif {unit(targetTestId) && `(${unit(targetTestId)})`}
              <input inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} className={`${field} w-28`} />
            </label>
            <label className="flex flex-col gap-1 text-sm grow">Libellé (facultatif)
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="ex. 2xPDC (142 kg)" className={field} />
            </label>
          </div>
          <p className="text-xs text-ink/60">Un seul objectif par test et par saison : l'enregistrer remplace le précédent.</p>
          <Button disabled={!targetTestId || !validNumber(t) || saveTarget.isPending}
            onClick={() => saveTarget.mutate({ playerId: player.id, season: seasonOf(today), testId: targetTestId, value: t!, label: label.trim() || null },
              { onSuccess: () => { setTarget(''); setLabel('') } })}>
            Enregistrer l'objectif
          </Button>
          {saveTarget.isSuccess && <p role="status" className="text-sm text-ok">Objectif enregistré.</p>}
          {saveTarget.isError && <p role="alert" className="text-sm text-rnr">Enregistrement impossible.</p>}
        </div>
      </div>
    </Card>
  )
}

import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { Coq } from '../performance/MatchColor'
import { fullName } from '../staff/load'
import { useRoster } from '../staff/useStaff'
import { COQ_LABEL, groupPodium, scaleOf, testCoq } from './coqs'
import { latestByTest } from './progress'
import { useGroupTestResults, useTestReference } from './useTests'

const number = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
const MEDAL = { or: '🥇', argent: '🥈', bronze: '🥉' } as const
const POSITIONS = ['Pilier', 'Talonneur', '2e ligne', '3e ligne', 'Demi de mêlée', "Demi d'ouverture", 'Centre', 'Ailier', 'Arrière']

// Tests et coqs (staff) : dernier résultat de chaque joueur, coq FFR à son poste, podium du groupe (décision du 10/11/2026)
export function TestCoqsBoard() {
  const roster = useRoster()
  const results = useGroupTestResults()
  const reference = useTestReference()
  if (roster.isPending || results.isPending || reference.isPending) return <Loading />
  if (roster.isError || results.isError || reference.isError) return <p role="alert">Impossible de charger les tests.</p>

  const { refs, defs } = reference.data
  const scaled = new Set(refs.map(r => r.test_id))
  // Tests passés qui ont un barème (directement ou converti en 1RM)
  const tests = [...new Map(results.data.map(r => [r.test_id, r.test_definitions])).entries()]
    .filter(([, d]) => scaled.has(defs.find(x => x.name === scaleOf(d.name).scale)?.id ?? ''))
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
  const latest = roster.data.flatMap(p => [...latestByTest(results.data.filter(r => r.player_id === p.id)).values()]
    .map(r => ({ player: p, r, value: Number(r.value) })))
  const podium = groupPodium(latest.map(l => ({ player_id: l.player.id, test_id: l.r.test_id, value: l.value, higherIsBetter: l.r.test_definitions.higher_is_better })))
  const count = (color: string) => latest.filter(l => testCoq({ testName: l.r.test_definitions.name, value: l.value,
    higherIsBetter: l.r.test_definitions.higher_is_better, position: l.player.position }, refs, defs)?.color === color).length

  return (
    <Card title="Tests et coqs FFR" help="Dernier test de chaque joueur, coq du référentiel FFR filière jeune à son poste (charnière : barème demi de mêlée). * : développé couché et squat convertis en 1RM estimé (3RM × 36/34 ; front squat ≈ 85 % du back squat). Médailles : podium du groupe sur le dernier test.">
      <p className="flex flex-wrap gap-3 text-sm">
        {(['bleu', 'vert', 'jaune', 'rouge'] as const).map(c => (
          <span key={c} className="flex items-center gap-1"><Coq color={c} className="h-5 w-5" /><strong className="tabular-nums">{count(c)}</strong> <span className="text-ink/60">{COQ_LABEL[c]}</span></span>
        ))}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink/55">
            <tr><th className="py-1 pr-3 font-normal">Joueur</th>{tests.map(([id, d]) => <th key={id} className="pr-3 font-normal">{d.name}<span className="block">{d.unit}</span></th>)}</tr>
          </thead>
          <tbody>
            {roster.data.map(p => (
              <tr key={p.id} className="border-t border-line">
                <td className="py-1.5 pr-3 font-semibold">{fullName(p)}<span className="block text-xs font-normal text-ink/55">{p.position ?? 'poste ?'}</span></td>
                {tests.map(([id, d]) => {
                  const l = latest.find(x => x.player.id === p.id && x.r.test_id === id)
                  if (!l) return <td key={id} className="pr-3 text-ink/40">—</td>
                  const coq = testCoq({ testName: d.name, value: l.value, higherIsBetter: d.higher_is_better, position: p.position }, refs, defs)
                  const medal = podium.get(`${p.id}|${id}`)
                  return (
                    <td key={id} className="pr-3">
                      <span className="flex items-center gap-1 tabular-nums" title={coq?.note ?? undefined}>
                        {coq && <><Coq color={coq.color} className="h-5 w-5" /><span className="sr-only">coq {COQ_LABEL[coq.color]}</span></>}
                        {number(l.value)}{coq?.estimated && <span aria-hidden="true" className="text-ink/50">*</span>}
                        {medal && <span role="img" aria-label={`médaille ${medal}`}>{MEDAL[medal]}</span>}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// Barème FFR (lecture) : seuils bleu / vert / jaune par poste ; en dessous du jaune, coq rouge
export function TestReferencePanel() {
  const reference = useTestReference()
  const [testId, setTestId] = useState('')
  if (reference.isPending) return <Loading />
  if (reference.isError) return <p role="alert">Impossible de charger le barème.</p>
  const { refs, defs } = reference.data
  const tests = defs.filter(d => refs.some(r => r.test_id === d.id)).sort((a, b) => a.name.localeCompare(b.name))
  const current = tests.find(t => t.id === testId) ?? tests[0]
  if (!current) return <p>Aucun barème enregistré.</p>
  return (
    <Card title="Barème FFR filière jeune (garçons)" help="Référentiel « Génération bleue » (janvier 2025). Entre deux seuils : l'échelon inférieur. Pour un temps, plus bas = mieux."
      aside={<ViewSelect label="Test" value={current.id} onChange={setTestId}>{tests.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</ViewSelect>}>
      <table className="text-sm">
        <thead className="text-left text-xs text-ink/55">
          <tr><th className="py-1 pr-6 font-normal">Poste</th>{(['bleu', 'vert', 'jaune'] as const).map(c => <th key={c} className="pr-6 font-normal"><span className="flex items-center gap-1"><Coq color={c} className="h-5 w-5" />{c}</span></th>)}</tr>
        </thead>
        <tbody>
          {POSITIONS.map(pos => {
            const r = refs.find(x => x.test_id === current.id && x.position_group === pos)
            return r && (
              <tr key={pos} className="border-t border-line tabular-nums">
                <td className="py-1.5 pr-6 font-semibold">{pos}</td><td className="pr-6">{number(Number(r.blue))}</td><td className="pr-6">{number(Number(r.green))}</td><td className="pr-6">{number(Number(r.yellow))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

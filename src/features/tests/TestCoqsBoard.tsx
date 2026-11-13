import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { Coq } from '../performance/MatchColor'
import { fullName } from '../staff/load'
import { useRoster } from '../staff/useStaff'
import { COQ_LABEL, groupPodium, scaleOf, testCoq } from './coqs'
import { latestByTest } from './progress'
import { Avatar } from '../photos/PlayerPhoto'
import { useGroupTestResults, useTestReference } from './useTests'

const number = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
const MEDAL = { or: '🥇', argent: '🥈', bronze: '🥉' } as const
const POSITIONS = ['Pilier', 'Talonneur', '2e ligne', '3e ligne', 'Demi de mêlée', "Demi d'ouverture", 'Centre', 'Ailier', 'Arrière']

const TINT = { bleu: 'bg-blue/15', vert: 'bg-ok/15', jaune: 'bg-gold/15', rouge: 'bg-rnr/15' } as const
const COLORS = ['bleu', 'vert', 'jaune', 'rouge'] as const

// Tests et coqs (staff), comme le tableau GPS : la répartition des coqs du groupe, puis un joueur par ligne, chaque case
// teintée de son coq (dernier résultat, barème FFR à son poste), médaille du podium ; tri par nom ou par test
export function TestCoqsBoard() {
  const roster = useRoster()
  const results = useGroupTestResults()
  const reference = useTestReference()
  const [sort, setSort] = useState('nom')
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
  const coqOfCell = (l: (typeof latest)[number]) => testCoq({ testName: l.r.test_definitions.name, value: l.value,
    higherIsBetter: l.r.test_definitions.higher_is_better, position: l.player.position }, refs, defs)
  const cells = latest.filter(l => tests.some(([id]) => id === l.r.test_id)).map(l => ({ ...l, coq: coqOfCell(l) }))
  const total = cells.filter(c => c.coq).length
  const count = (color: string) => cells.filter(c => c.coq?.color === color).length
  // Tri par test : meilleur résultat d'abord (selon le sens du test), sans résultat à la fin
  const sortTest = tests.find(([id]) => id === sort)
  const rows = [...roster.data].sort((a, b) => {
    if (!sortTest) return 0
    const va = latest.find(x => x.player.id === a.id && x.r.test_id === sortTest[0])?.value
    const vb = latest.find(x => x.player.id === b.id && x.r.test_id === sortTest[0])?.value
    if (va == null || vb == null) return va == null ? 1 : -1
    return sortTest[1].higher_is_better ? vb - va : va - vb
  })

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Tests et coqs FFR</h2>
          <p className="max-w-prose text-sm text-ink/60">Dernier test de chaque joueur, coq du référentiel FFR filière jeune à son poste. Médailles : podium du groupe.</p>
        </div>
        <ViewSelect label="Trier par" value={sort} onChange={setSort}>
          <option value="nom">Nom</option>
          {tests.map(([id, d]) => <option key={id} value={id}>{d.name}</option>)}
        </ViewSelect>
      </div>

      {/* Répartition des coqs du groupe, tous tests confondus */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COLORS.map(c => (
          <div key={c} className="flex items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line/60">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TINT[c]}`}><Coq color={c} className="h-8 w-8" /></span>
            <div>
              <p className="font-display text-3xl font-semibold leading-none tabular-nums">{count(c)}<span className="ml-1 text-base text-ink/60">{total ? `${Math.round((100 * count(c)) / total)} %` : ''}</span></p>
              <p className="text-sm text-ink/60">coq {COQ_LABEL[c]}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-line/60">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink/60">
            <tr>
              <th className="sticky left-0 bg-surface px-4 py-3 font-normal">Joueur</th>
              {tests.map(([id, d]) => (
                <th key={id} className={`px-2 py-3 font-normal ${sort === id ? 'text-ink' : ''}`}>
                  <span className="font-semibold">{d.name}</span>
                  <span className="block">{d.unit}{scaleOf(d.name).factor !== 1 && ' · 1RM estimé *'}{d.higher_is_better ? '' : ' · plus bas = mieux'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.id} className="border-t border-line/60">
                <td className="sticky left-0 whitespace-nowrap bg-surface px-4 py-2">
                  <span className="flex items-center gap-2"><Avatar id={p.id} name={fullName(p)} className="h-8 w-8" /><span><span className="font-semibold">{fullName(p)}</span><span className="block text-xs text-ink/60">{p.position ?? 'poste ?'}</span></span></span>
                </td>
                {tests.map(([id]) => {
                  const c = cells.find(x => x.player.id === p.id && x.r.test_id === id)
                  if (!c) return <td key={id} className="px-2 text-ink/40">—</td>
                  const medal = podium.get(`${p.id}|${id}`)
                  return (
                    <td key={id} className="px-1.5 py-1.5">
                      <span className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 tabular-nums ${c.coq ? TINT[c.coq.color] : 'bg-field'}`}
                        title={[c.coq && `coq ${COQ_LABEL[c.coq.color]}`, c.coq?.note].filter(Boolean).join(' · ') || 'pas de barème pour ce poste'}>
                        {c.coq ? <Coq color={c.coq.color} className="h-5 w-5" /> : <span className="h-5 w-5" aria-hidden="true" />}
                        {c.coq && <span className="sr-only">coq {COQ_LABEL[c.coq.color]}</span>}
                        <span className="font-semibold">{number(c.value)}</span>{c.coq?.estimated && <span aria-hidden="true" className="text-ink/60">*</span>}
                        {medal && <span role="img" aria-label={`médaille ${medal}`} className="ml-auto">{MEDAL[medal]}</span>}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink/60">Charnière : barème demi de mêlée. * Développé couché et squat convertis en 1RM estimé (3RM × 36/34 ; front squat ≈ 85 % du back squat). Case grise : poste sans barème.</p>
    </section>
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
        <thead className="text-left text-xs text-ink/60">
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

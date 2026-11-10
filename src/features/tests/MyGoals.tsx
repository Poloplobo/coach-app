import { Check, Trophy } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { movementIcon } from './movementIcon'
import { goalProgress, latestByTest, seasonOf } from './progress'
import { useMyMedals, usePlayerPosition, useTargets, useTestReference, useTestResults, type Medal } from './useTests'
import { COQ_LABEL, ffrPosition, scaleOf, testCoq } from './coqs'
import { nextCoq } from './nextCoq'
import { Coq } from '../performance/MatchColor'

const number = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
const month = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' })
// Écart réel avec son signe (« +3 cm », « −0,06 s ») ; la couleur verte dit si c'est un progrès, selon le sens du test
const signed = (v: number, unit: string) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${number(Math.abs(v))} ${unit}`

// Objectifs de la saison et tests : ce qu'il reste à gagner pour chaque objectif, d'où il part, l'objectif le plus proche.
// title : « Mes objectifs » côté joueur, un titre neutre côté staff
// medals : côté joueur, ses médailles du podium du groupe (le staff voit le podium dans Performance › Test)
export function MyGoals({ playerId, date, title = 'Mes objectifs', medals = false }: { playerId: string; date: string; title?: string; medals?: boolean }) {
  const results = useTestResults(playerId)
  const targets = useTargets(playerId, seasonOf(date))
  const reference = useTestReference()
  const position = usePlayerPosition(playerId)
  const myMedals = useMyMedals(medals)

  if (results.isPending || targets.isPending) return <Card title={title}><Loading /></Card>
  if (results.isError || targets.isError) return <Card title={title}><p>Impossible de charger tes tests.</p></Card>

  const history = (testId: string) => results.data.filter(r => r.test_id === testId).map(r => ({ test_date: r.test_date, value: Number(r.value) }))
  const goals = targets.data.map(t => ({ t, g: goalProgress(history(t.test_id), Number(t.target_value), t.test_definitions.higher_is_better) }))
  // Les plus proches d'abord, ceux atteints en fin de liste (avec leur coche) ; sans résultat tout à la fin
  goals.sort((a, b) => Number(a.g?.reached ?? 2) - Number(b.g?.reached ?? 2) || (b.g?.pct ?? -1) - (a.g?.pct ?? -1))
  const reached = goals.filter(x => x.g?.reached).length
  const closest = goals.find(x => x.g && !x.g.reached)
  const targeted = new Set(targets.data.map(t => t.test_id))
  const others = [...latestByTest(results.data).values()].filter(r => !targeted.has(r.test_id))

  // Coq FFR (barème au poste du joueur) d'un résultat ; rien sans barème, sans poste ou en chargement
  const coqFor = (name: string, value: number | undefined, higherIsBetter: boolean) =>
    value != null && reference.data ? testCoq({ testName: name, value, higherIsBetter, position: position.data ?? null }, reference.data.refs, reference.data.defs) : null
  // « Coq vert : encore 1 cm » (écart dans l'unité du test passé, même converti en 1RM)
  const toNext = (name: string, unit: string, value: number | undefined, higherIsBetter: boolean) => {
    const coq = coqFor(name, value, higherIsBetter)
    if (!coq) return null
    const n = nextCoq(coq, higherIsBetter, scaleOf(name).factor)
    return n
      ? <span className="flex items-center gap-1 text-xs text-ink/65"><Coq color={n.color} className="h-4 w-4" />Coq {n.color} : encore {coq.estimated ? `≈ ${number(Math.ceil(n.gap * 2) / 2)}` : number(n.gap)} {unit}</span>
      : <span className="flex items-center gap-1 text-xs font-semibold text-blue"><Coq color="bleu" className="h-4 w-4" />Coq bleu : le plus haut niveau jeune</span>
  }
  // Mes coqs et médailles, sur le dernier résultat de chaque test
  const myCoqs = [...latestByTest(results.data).values()]
    .map(r => coqFor(r.test_definitions.name, Number(r.value), r.test_definitions.higher_is_better)).filter(c => c !== null)
  const medalCount = (m: Medal) => [...(myMedals.data?.values() ?? [])].filter(x => x === m).length
  // Coq FFR et médaille du groupe d'un test, à côté de son nom
  const level = (testId: string, name: string, value: number | undefined, higherIsBetter: boolean) => {
    const coq = coqFor(name, value, higherIsBetter)
    const medal = myMedals.data?.get(testId)
    if (!coq && !medal) return null
    return <Level coq={coq} medal={medal} />
  }
  const anyCoq = !!reference.data && !!position.data && results.data.some(r => testCoq({ testName: r.test_definitions.name, value: Number(r.value),
    higherIsBetter: r.test_definitions.higher_is_better, position: position.data ?? null }, reference.data!.refs, reference.data!.defs))

  if (!goals.length && !others.length) return <Card title={title}><p className="text-sm text-ink/70">Pas encore de test ni d'objectif enregistré.</p></Card>

  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-semibold leading-tight">{title}</h2>
      {goals.length > 0 && (
        // Résumé : objectifs atteints sur la saison et le prochain à aller chercher
        <div className="flex items-center gap-4 rounded-2xl bg-surface p-5 ring-1 ring-line/60">
          <Ring done={reached} total={goals.length} />
          <div className="min-w-0">
            <p className="font-display text-2xl font-semibold leading-tight">{reached} objectif{reached > 1 ? 's' : ''} atteint{reached > 1 ? 's' : ''} <span className="text-ink/50">sur {goals.length}</span></p>
            {closest?.g
              ? <p className="text-sm text-ink/70">Le plus proche : <strong className="text-ink">{closest.t.test_definitions.name}</strong>, encore {number(closest.g.remaining)} {closest.t.test_definitions.unit}</p>
              : <p className="text-sm font-semibold text-ok">Tous tes objectifs sont atteints, bravo !</p>}
          </div>
        </div>
      )}

      {myCoqs.length > 0 && (
        // Mes coqs FFR (barème jeune à mon poste) et mes médailles du groupe, d'un coup d'œil
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line/60">
          <p className="flex items-baseline justify-between gap-3">
            <span className="font-display text-lg font-semibold">Mes coqs FFR</span>
            <span className="text-xs text-ink/55">barème {ffrPosition(position.data ?? null)}</span>
          </p>
          <ul className="grid grid-cols-4 gap-2">
            {(['bleu', 'vert', 'jaune', 'rouge'] as const).map(c => (
              <li key={c} className={`flex flex-col items-center gap-1 rounded-xl bg-field py-2 ${myCoqs.some(x => x.color === c) ? '' : 'opacity-40'}`}>
                <Coq color={c} className="h-8 w-8" />
                <span className="font-display text-xl font-semibold leading-none tabular-nums">{myCoqs.filter(x => x.color === c).length}</span>
                <span className="text-[11px] text-ink/55">{c}</span>
              </li>
            ))}
          </ul>
          {myMedals.data && myMedals.data.size > 0 && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-ink/60">Podium du groupe :</span>
              {(['or', 'argent', 'bronze'] as const).filter(m => medalCount(m) > 0).map(m => (
                <span key={m} className="font-semibold tabular-nums">{MEDAL[m]} × {medalCount(m)}</span>
              ))}
            </p>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {goals.map(({ t, g }) => {
          const unit = t.test_definitions.unit
          const Icon = movementIcon(t.test_definitions.name)
          return (
            <li key={t.test_id} className={`flex flex-col gap-2.5 rounded-2xl p-4 ring-1 ${g?.reached ? 'bg-ok/10 ring-ok/40' : 'bg-surface ring-line/60'}`}>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${g?.reached ? 'bg-ok text-app' : 'bg-gold/15 text-gold'}`}>
                  {g?.reached ? <Trophy size={20} /> : <Icon size={20} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-semibold"><span className="truncate">{t.test_definitions.name}</span>{level(t.test_id, t.test_definitions.name, g?.last.value, t.test_definitions.higher_is_better)}</p>
                  <p className="text-xs text-ink/60">Objectif : {t.label ?? `${number(Number(t.target_value))} ${unit}`}</p>
                </div>
                {g?.reached
                  ? <span className="flex shrink-0 items-center gap-1 rounded-full bg-ok px-2.5 py-1 text-xs font-semibold text-app"><Check size={14} strokeWidth={3} aria-hidden="true" />Atteint</span>
                  : g && <span className="shrink-0 text-right"><span className="block text-xs text-ink/55">encore</span><span className="font-display text-xl font-semibold tabular-nums text-gold">{number(g.remaining)} {unit}</span></span>}
              </div>
              {g ? (
                <>
                  {/* Jauge du premier test à l'objectif : où il en est sur le chemin */}
                  <div className="h-2.5 rounded-full bg-field" role="progressbar" aria-valuenow={g.pct} aria-valuemin={0} aria-valuemax={100}
                    aria-label={`${t.test_definitions.name} : ${g.pct} % du chemin vers l'objectif`}>
                    <div className={`h-full rounded-full ${g.reached ? 'bg-ok' : 'bg-gold'}`} style={{ width: `${Math.max(3, g.pct)}%` }} />
                  </div>
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span><span className="text-ink/60">Dernier test </span><strong className="tabular-nums">{number(g.last.value)} {unit}</strong></span>
                    {g.gained !== null && (
                      <span className={`tabular-nums ${g.gained > 0 ? 'font-semibold text-ok' : 'text-ink/60'}`}>
                        {g.gained === 0 ? `stable depuis ${month(g.first.test_date)}` : `${signed(g.last.value - g.first.value, unit)} depuis ${month(g.first.test_date)}`}
                      </span>
                    )}
                  </p>
                  {toNext(t.test_definitions.name, unit, g.last.value, t.test_definitions.higher_is_better)}
                </>
              ) : <p className="text-sm text-ink/55">Pas encore testé cette saison.</p>}
            </li>
          )
        })}
      </ul>

      {anyCoq && (
        <p className="text-xs text-ink/55">
          Coqs : référentiel FFR filière jeune, barème {ffrPosition(position.data ?? null)}. Bleu premium, vert très bon, jaune bon, rouge à améliorer.
          {' '}<span aria-hidden="true">*</span> estimé (développé couché et squat convertis en 1RM).{medals && ' Médailles : podium du groupe sur le dernier test.'}
        </p>
      )}
      {others.length > 0 && (
        // Tests sans objectif : dernier résultat et évolution, en plus discret
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Autres tests</h3>
          <ul className="flex flex-col divide-y divide-line/60 rounded-2xl bg-surface px-4 ring-1 ring-line/60 text-sm">
            {others.map(r => {
              const g = goalProgress(history(r.test_id), Number(r.value), r.test_definitions.higher_is_better)
              return (
                <li key={r.test_id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-1.5"><span className="truncate">{r.test_definitions.name}</span>{level(r.test_id, r.test_definitions.name, Number(r.value), r.test_definitions.higher_is_better)}</span>
                    {toNext(r.test_definitions.name, r.test_definitions.unit, Number(r.value), r.test_definitions.higher_is_better)}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <strong>{number(Number(r.value))} {r.test_definitions.unit}</strong>
                    {g?.gained != null && g.gained !== 0 && <span className={`ml-2 text-xs ${g.gained > 0 ? 'text-ok' : 'text-ink/55'}`}>{signed(g.last.value - g.first.value, r.test_definitions.unit)}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

// Anneau des objectifs atteints sur la saison
function Ring({ done, total }: { done: number; total: number }) {
  const c = 2 * Math.PI * 26
  return (
    <span className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" aria-hidden="true" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r="26" strokeWidth="7" className="fill-none stroke-field" />
        <circle cx="32" cy="32" r="26" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - done / total)} className="fill-none stroke-ok" />
      </svg>
      <span className="font-display text-xl font-semibold tabular-nums">{done}<span className="text-sm text-ink/50">/{total}</span></span>
    </span>
  )
}

const MEDAL: Record<Medal, string> = { or: '🥇', argent: '🥈', bronze: '🥉' }

// Coq FFR du dernier résultat (* si estimé depuis un 3RM ou un front squat) et médaille du podium du groupe
function Level({ coq, medal }: { coq: ReturnType<typeof testCoq>; medal?: Medal }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {coq && (
        <span className="flex items-center" title={coq.note ?? undefined}>
          <Coq color={coq.color} className="h-6 w-6" />
          <span className="sr-only">Coq {COQ_LABEL[coq.color]}{coq.note ? ` (${coq.note})` : ''}</span>
          {coq.estimated && <span aria-hidden="true" className="text-xs text-ink/50">*</span>}
        </span>
      )}
      {medal && <span role="img" aria-label={`Médaille ${medal === 'or' ? "d'or" : medal === 'argent' ? "d'argent" : 'de bronze'} du groupe`} className="text-base leading-none">{MEDAL[medal]}</span>}
    </span>
  )
}

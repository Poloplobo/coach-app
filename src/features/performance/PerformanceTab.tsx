import { useRef, useState } from 'react'
import { Dumbbell, Satellite, Star } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { OfflineNote } from '../../components/ui/OfflineNote'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { formatDay } from '../../lib/week'
import { usePlayerDay } from '../player/playerDay'
import { MyGoals } from '../tests/MyGoals'
import { RATING_LABEL as COLOR_LABEL, RATING_COLORS, gpsAnalysis, MIN_MINUTES, positionGroup, vmaxTimeline, type RatingColor } from './gps'
import { ClubLogo, Coq } from './MatchColor'
import { playerReport } from './report'
import { Cutout } from '../photos/PlayerPhoto'
import { useGpsRecords, useGpsReference, useGuidelines, useMatches, useRateMatch, useRatings } from './usePerformance'

// Onglet joueur en trois volets séparés, qu'on change au sélecteur ou en glissant le doigt sur le côté :
// NOTES (sa note du match du week-end, le dernier joué, puis l'avis du coach), GPS (8 boîtiers : pas toujours), TESTS (maxi
// et objectifs). Note et GPS sont indépendants.
const PANES = [
  { id: 'notes', label: 'Notes', icon: Star },
  { id: 'gps', label: 'GPS', icon: Satellite },
  { id: 'tests', label: 'Tests', icon: Dumbbell },
] as const
type Pane = (typeof PANES)[number]['id']
export function PerformanceTab() {
  const { playerId, today } = usePlayerDay()
  const matches = useMatches()
  const gps = useGpsRecords(playerId)
  const ratings = useRatings(playerId)
  const reference = useGpsReference()
  const rate = useRateMatch()
  const guidelines = useGuidelines()
  // Choix en cours, pas encore validé (lié au match : changer de match l'efface)
  const [choice, setChoice] = useState<{ match: string; color: RatingColor } | null>(null)
  const [comment, setComment] = useState('')
  const [pane, setPane] = useState<Pane>('notes')
  const touch = useRef<{ x: number; y: number } | null>(null)
  // Glisser horizontal franc (60 px, plus large que haut) : volet suivant ou précédent ; le défilement vertical reste libre
  const swipe = (x: number, y: number) => {
    const t = touch.current
    touch.current = null
    if (!t || Math.abs(x - t.x) < 60 || Math.abs(x - t.x) < Math.abs(y - t.y)) return
    const i = PANES.findIndex(p => p.id === pane) + (x < t.x ? 1 : -1)
    if (PANES[i]) setPane(PANES[i].id)
  }

  const commentOk = choice?.color === 'gris' || comment.trim().length >= 10
  const loading = matches.isPending || gps.isPending || ratings.isPending || reference.isPending
  const failed = matches.isError || gps.isError || ratings.isError || reference.isError
  const match = matches.data?.[0] // match du week-end : le dernier joué (la note reste ouverte jusqu'au suivant)
  const own = ratings.data?.find(r => r.match_id === match?.id && r.rater === 'player')
  // La RLS ne rend l'avis du coach (coq, commentaire, temps de jeu) qu'après la note du joueur ; l'écran ne s'y fie pas seul
  const staff = own ? ratings.data?.find(r => r.match_id === match?.id && r.rater === 'staff') : undefined
  const record = gps.data?.find(g => g.match_id === match?.id)
  const dateOf = new Map(matches.data?.map(m => [m.id, m.match_date]))
  const vmax = vmaxTimeline((gps.data ?? []).map(g => ({ date: dateOf.get(g.match_id) ?? '', vmax: g.vmax })))
    .find(v => v.date === match?.match_date)
  const ref = record && reference.data ? reference.data.refs.get(positionGroup(record.position, reference.data.positions) ?? '') ?? null : null
  const analysis = record ? gpsAnalysis(record, ref) : null

  const noMatch = !loading && !failed && !match && <Card title="Mes matchs"><p className="text-sm text-ink/70">Aucun match enregistré pour l'instant.</p></Card>
  return (
    <div className="flex flex-col gap-4">
      {/* Sélecteur des volets ; pastille sur Notes tant que le match du week-end n'est pas noté */}
      <div role="tablist" aria-label="Mes performances" className="grid grid-cols-3 gap-1 rounded-2xl bg-field p-1">
        {PANES.map(p => (
          <button key={p.id} id={`perf-${p.id}`} type="button" role="tab" aria-selected={pane === p.id} aria-controls="perf-pane" onClick={() => setPane(p.id)}
            className={`relative flex h-11 items-center justify-center gap-1.5 rounded-xl font-display text-sm font-semibold uppercase tracking-wider transition-colors ${
              pane === p.id ? 'bg-surface text-ink shadow-sm ring-1 ring-line/60' : 'text-ink/55'}`}>
            <p.icon size={15} aria-hidden="true" />{p.label}
            {p.id === 'notes' && match && !own && !loading && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rnr" aria-label="match à noter" />}
          </button>
        ))}
      </div>
      <div id="perf-pane" role="tabpanel" aria-labelledby={`perf-${pane}`} key={pane} className="flex touch-pan-y flex-col gap-6"
        onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
        onTouchEnd={e => swipe(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}>
      {/* Carte de joueur : le joueur détouré en tête de ses GPS et de ses tests */}
      {pane !== 'notes' && <Cutout id={playerId} className="mx-auto -mb-4 h-40 w-40" />}
      {loading && pane !== 'tests' && <Loading />}
      {failed && pane !== 'tests' && <p role="alert">Impossible de charger tes matchs.</p>}
      {pane !== 'tests' && noMatch}
      {match && pane === 'notes' && (
          <Card boxed title="Mon match du week-end" help={own ? undefined : 'Comment as-tu joué ? Une fois validée, ta note ne change plus et celle du coach s\'affiche.'}>
            <p className="flex items-center gap-3 font-semibold"><ClubLogo match={match} className="h-10 w-10" />
              <span>{match.label ? `${match.label} · ` : ''}{match.opponent}
                <span className="block text-sm font-normal text-ink/60">{formatDay(match.match_date)}{match.home === null ? '' : match.home ? ' · à domicile' : ' · à l\'extérieur'}{staff?.minutes != null ? ` · ${staff.minutes} min jouées` : ''}</span>
              </span>
            </p>
            {own ? (
              // Note validée : face-à-face avec le coach (son évaluation n'apparaît qu'après la note du joueur)
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Verdict who="Ma note" color={own.color} />
                  <Verdict who="Le coach" color={staff?.color ?? null} />
                </div>
                {own.comment && <p className="text-sm text-ink/70"><span className="font-semibold text-ink">Mon commentaire : </span>{own.comment}</p>}
                {staff && staff.color === own.color && <p className="text-center text-sm font-semibold text-ok">Même lecture que le coach</p>}
                {staff?.comment && <p className="border-l-2 border-gold pl-3 text-sm italic">« {staff.comment} »</p>}
                <p className="text-xs text-ink/50">Note validée : elle ne peut plus être modifiée.</p>
              </>
            ) : (
              <>
                {/* Note figée une fois validée : on ne s'aligne pas sur la note du staff découverte ensuite */}
                <div role="radiogroup" aria-label="Ma note du match" className="flex flex-col gap-1.5">
                  {RATING_COLORS.map(c => {
                    const selected = choice?.match === match.id && choice.color === c
                    return (
                      <button key={c} type="button" role="radio" aria-checked={selected} disabled={rate.isPending}
                        onClick={() => setChoice({ match: match.id, color: c })}
                        className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${selected ? 'border-ink bg-field' : 'border-line/70'}`}>
                        <Coq color={c} className="h-8 w-8" />
                        <span className="flex flex-col">{COLOR_LABEL[c]}
                          {guidelines.data?.get(c) && <span className="text-xs font-normal text-ink/60">{guidelines.data.get(c)}</span>}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {/* Commentaire obligatoire pour justifier sa note (0042), sauf « gris » : n'a pas joué */}
                {choice?.match === match.id && choice.color !== 'gris' && (
                  <label className="flex flex-col gap-1 text-sm font-semibold">Pourquoi cette note ?
                    <textarea rows={3} maxLength={500} value={comment} onChange={e => setComment(e.target.value)}
                      placeholder="Ce que tu as bien fait, ce que tu dois corriger…"
                      className="rounded-lg border border-line bg-field px-3 py-2 text-base font-normal" />
                    <span className="text-xs font-normal text-ink/60">{commentOk ? 'Merci, ton commentaire est complet.' : 'Obligatoire : au moins une phrase (10 caractères).'}</span>
                  </label>
                )}
                <Button disabled={choice?.match !== match.id || rate.isPending || !commentOk}
                  onClick={() => choice && rate.mutate({ match_id: match.id, player_id: playerId, rater: 'player', color: choice.color, comment: choice.color === 'gris' ? (comment.trim() || null) : comment.trim() })}>
                  {rate.isPending ? 'Enregistrement…' : 'Valider ma note'}
                </Button>
                <OfflineNote shown={rate.isPaused} />
                {rate.isError && <p role="alert" className="text-sm text-rnr">Note non enregistrée, réessaie.</p>}
                <p className="text-center text-sm text-ink/60">Note ton match pour découvrir l'évaluation du coach.</p>
              </>
            )}
          </Card>
      )}
      {match && pane === 'gps' && (
        <>
          {/* Sans GPS sur ce match (8 boîtiers pour le groupe) : partie grisée, la note et les objectifs restent */}
          <Card title="Mon GPS du week-end" help={record ? `Comparé à l'attendu de ton poste (${record.position.toLowerCase()}), ramené à un match de 70 min. Le trait marque l'attendu.` : undefined}>
            {!record
              ? <p aria-disabled="true" className="rounded-lg bg-field px-3 py-4 text-center text-sm text-ink/45">Pas de GPS pour toi sur ce match.</p>
              : (
                <>
                  <div className="flex items-center gap-4">
                    {analysis
                      ? <span className="flex items-center gap-2"><Coq color={analysis.color} className="h-12 w-12" />
                          <span className="font-display text-3xl font-semibold leading-none tabular-nums">{analysis.filled}/3<span className="block font-sans text-xs font-normal text-ink/60">attendus remplis</span></span></span>
                      : <span className="text-sm text-ink/60">{ref ? `Temps de jeu < ${MIN_MINUTES} min : pas de comparaison.` : 'Poste sans attendu au référentiel : pas de comparaison.'}</span>}
                    <dl className="ml-auto flex gap-4 text-right">
                      <div className="flex flex-col-reverse"><dt className="text-xs text-ink/60">Temps de jeu</dt><dd className="font-display text-xl font-semibold tabular-nums">{record.minutes}<span className="text-sm text-ink/60"> min</span></dd></div>
                      <div className="flex flex-col-reverse"><dt className="text-xs text-ink/60">Vmax</dt>
                        <dd className="font-display text-xl font-semibold tabular-nums">{record.vmax ? String(record.vmax).replace('.', ',') : '—'}<span className="text-sm text-ink/60"> km/h</span>
                          {vmax?.record && <span className="block text-xs font-semibold text-gold">record !</span>}
                          {vmax && !vmax.record && !vmax.first && vmax.pctOfBest !== null && <span className="block font-sans text-xs font-normal text-ink/60">{vmax.pctOfBest} % de ton record</span>}
                        </dd></div>
                    </dl>
                  </div>
                  <dl className="flex flex-col gap-3">
                    <GpsBar label="Distance" value={`${record.distance_m.toLocaleString('fr-FR')} m`} pct={analysis?.pct.distance ?? null} />
                    <GpsBar label="Haute intensité (> 21 km/h)" value={`${record.hi_distance_m.toLocaleString('fr-FR')} m`} pct={analysis?.pct.hi ?? null} />
                    <GpsBar label="Accélérations" value={String(record.accelerations)} pct={analysis?.pct.accelerations ?? null} />
                  </dl>
                </>
              )}
          </Card>

          {reference.data && (
            <LastMatches report={playerReport({ player: { id: playerId, first_name: '', last_name: '' }, matches: matches.data!.slice(0, 3),
              records: gps.data!, ref: reference.data })} />
          )}
        </>
      )}
      {pane === 'tests' && <MyGoals playerId={playerId} date={today} title="Mes maxi et objectifs" medals />}
      </div>
    </div>
  )
}

// Une case du face-à-face : grand coq et son libellé ; coach pas encore passé : case en pointillés
function Verdict({ who, color }: { who: string; color: RatingColor | null }) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center ${color ? 'bg-field' : 'border border-dashed border-line'}`}>
      <span className="text-xs text-ink/60">{who}</span>
      {color ? <Coq color={color} className="h-12 w-12" /> : <span className="flex h-12 items-center text-ink/40">—</span>}
      <span className="text-sm font-semibold">{color ? COLOR_LABEL[color] : 'pas encore évalué'}</span>
    </div>
  )
}

// Valeur et barre face à l'attendu du poste (trait à 100 %, échelle jusqu'à 130 %) ; sans attendu : la valeur seule
const SCALE = 130
function GpsBar({ label, value, pct }: { label: string; value?: string; pct: number | null }) {
  const ok = pct !== null && pct >= 100
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-sm text-ink/70">{label}</dt>
        <dd className="flex items-baseline gap-2 tabular-nums">
          {value && <span className="font-display text-lg font-semibold">{value}</span>}
          {pct !== null ? <span className={`text-sm font-semibold ${ok ? 'text-ok' : 'text-ink/60'}`}>{pct} %</span> : !value && <span className="text-ink/50">—</span>}
        </dd>
      </div>
      {pct !== null && (
        <div className="relative h-2 rounded-full bg-field" aria-hidden="true">
          <div className={`h-full rounded-full ${ok ? 'bg-ok' : 'bg-ink/45'}`} style={{ width: `${Math.max(3, Math.min(pct, SCALE) * 100 / SCALE)}%` }} />
          <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink/70" style={{ left: `${10000 / SCALE}%` }} />
        </div>
      )}
    </div>
  )
}

// Vue d'ensemble de ses 3 derniers matchs (calque du « Bilan bloc ») : couleur GPS de chacun, moyennes face aux
// attendus de son poste, record Vmax, axe de travail. Sans GPS sur ces matchs : bloc grisé.
function LastMatches({ report: r }: { report: ReturnType<typeof playerReport> }) {
  const chrono = [...r.history]
  return (
    <Card boxed title="Mes 3 derniers matchs" help="GPS comparé aux attendus de ton poste, ramené à 70 min. Le coq donne le nombre d'attendus remplis (0 à 3).">
      <ul className="grid grid-cols-3 gap-2 text-center text-xs">
        {chrono.map(h => (
          <li key={h.match.id} className={`flex flex-col items-center gap-1 rounded-xl bg-field px-1 py-2.5 ${h.analysis ? '' : 'opacity-50'}`}>
            {h.analysis ? <Coq color={h.analysis.color} className="h-9 w-9" /> : <span className="flex h-9 items-center text-ink/50">—</span>}
            <span className="font-semibold">{h.match.label ?? h.match.opponent}</span>
            <span className="text-ink/60">{h.analysis ? `${h.analysis.filled}/3` : h.record ? '< 20 min' : 'pas de GPS'}</span>
          </li>
        ))}
      </ul>
      {r.analysed > 0 ? (
        <dl className="flex flex-col gap-3">
          {([['Distance', r.pcts.distance], ['Haute intensité', r.pcts.hi], ['Accélérations', r.pcts.accelerations]] as const).map(([label, pct]) =>
            <GpsBar key={label} label={`${label} (moyenne)`} pct={pct} />)}
        </dl>
      ) : <p className="text-sm text-ink/60">Pas encore de match analysé (GPS et au moins 20 minutes jouées).</p>}
      <p className="text-sm">
        {r.vmaxMax ? <>Vmax max : <strong>{String(r.vmaxMax).replace('.', ',')} km/h</strong></> : null}
        {r.axis && (Object.values(r.pcts).every(p => p !== null && p >= 100)
          ? <span className="block text-ink/70">Tous les attendus de ton poste sont atteints en moyenne.</span>
          : <span className="block text-ink/70">Axe de travail : {r.axis.toLowerCase()}, l'attendu le moins atteint.</span>)}
      </p>
    </Card>
  )
}

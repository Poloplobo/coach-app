import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { formatDay } from '../../lib/week'
import { usePlayerDay } from '../player/playerDay'
import { MyGoals } from '../tests/MyGoals'
import { COLOR_LABEL, RATING_COLORS, gpsAnalysis, MIN_MINUTES, positionGroup, vmaxTimeline, type RatingColor } from './gps'
import { Coq, MatchColor } from './MatchColor'
import { playerReport } from './report'
import { useGpsRecords, useGpsReference, useGuidelines, useMatches, useRateMatch, useRatings } from './usePerformance'

// Onglet joueur : après le match, il se note, découvre la note du staff, son GPS (8 boîtiers : pas toujours), ses maxi
export function PerformanceTab() {
  const { playerId, today } = usePlayerDay()
  const matches = useMatches()
  const gps = useGpsRecords(playerId)
  const ratings = useRatings(playerId)
  const reference = useGpsReference()
  const rate = useRateMatch()
  const guidelines = useGuidelines()
  const [matchId, setMatchId] = useState('')
  // Choix en cours, pas encore validé (lié au match : changer de match l'efface)
  const [choice, setChoice] = useState<{ match: string; color: RatingColor } | null>(null)

  const loading = matches.isPending || gps.isPending || ratings.isPending || reference.isPending
  const failed = matches.isError || gps.isError || ratings.isError || reference.isError
  const match = matches.data?.find(m => m.id === matchId) ?? matches.data?.[0]
  const own = ratings.data?.find(r => r.match_id === match?.id && r.rater === 'player')
  const staff = ratings.data?.find(r => r.match_id === match?.id && r.rater === 'staff')
  const record = gps.data?.find(g => g.match_id === match?.id)
  const dateOf = new Map(matches.data?.map(m => [m.id, m.match_date]))
  const vmax = vmaxTimeline((gps.data ?? []).map(g => ({ date: dateOf.get(g.match_id) ?? '', vmax: g.vmax })))
    .find(v => v.date === match?.match_date)
  const ref = record && reference.data ? reference.data.refs.get(positionGroup(record.position, reference.data.positions) ?? '') ?? null : null
  const analysis = record ? gpsAnalysis(record, ref) : null

  return (
    <div className="flex flex-col gap-6">
      {loading && <Loading />}
      {failed && <p role="alert">Impossible de charger tes matchs.</p>}
      {!loading && !failed && !match && <Card title="Mes matchs"><p className="text-sm text-ink/70">Aucun match enregistré pour l'instant.</p></Card>}
      {match && reference.data && (
        <LastMatches report={playerReport({ player: { id: playerId, first_name: '', last_name: '' }, matches: matches.data!.slice(0, 3),
          records: gps.data!, ratings: ratings.data!, ref: reference.data })} />
      )}
      {match && (
        <>
          <ViewSelect label="Match" value={match.id} onChange={setMatchId}>
            {matches.data!.map(m => <option key={m.id} value={m.id}>{m.label ? `${m.label} · ` : ''}{m.opponent} · {formatDay(m.match_date)}</option>)}
          </ViewSelect>

          <Card boxed title="Ma note du match" help="Comment as-tu joué par rapport au niveau du match ? Une fois validée, ta note ne change plus et celle du staff s'affiche.">
            {/* Note figée une fois validée : on ne s'aligne pas sur la note du staff découverte ensuite */}
            <div role="radiogroup" aria-label="Ma note du match" className="grid grid-cols-2 gap-2">
              {RATING_COLORS.map(c => {
                const selected = own ? own.color === c : choice?.match === match.id && choice.color === c
                return (
                  <button key={c} type="button" role="radio" aria-checked={selected} disabled={!!own || rate.isPending}
                    onClick={() => setChoice({ match: match.id, color: c })}
                    className={`flex min-h-12 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold disabled:cursor-default ${selected ? 'border-ink bg-field' : 'border-line'} ${own && !selected ? 'opacity-40' : ''}`}>
                    <Coq color={c} className="h-8 w-8" />
                    <span className="flex flex-col">{COLOR_LABEL[c]}
                      {guidelines.data?.get(c) && <span className="text-xs font-normal text-ink/60">{guidelines.data.get(c)}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
            {own
              ? <p className="text-sm text-ink/60">Note validée : elle ne peut plus être modifiée.</p>
              : (
                <Button disabled={choice?.match !== match.id || rate.isPending}
                  onClick={() => choice && rate.mutate({ match_id: match.id, player_id: playerId, rater: 'player', color: choice.color })}>
                  {rate.isPending ? 'Enregistrement…' : 'Valider ma note'}
                </Button>
              )}
            {rate.isError && <p role="alert" className="text-sm text-rnr">Note non enregistrée, réessaie.</p>}
          </Card>

          <Card title="Note du staff">
            {!own
              ? <p className="text-sm text-ink/70">Note ton match pour découvrir la note du staff.</p>
              : staff ? <MatchColor color={staff.color} label={COLOR_LABEL[staff.color]} /> : <p className="text-sm text-ink/70">Le staff n'a pas encore noté ce match.</p>}
          </Card>

          {/* Sans GPS sur ce match (8 boîtiers pour le groupe) : partie grisée, la note et les objectifs restent */}
          <Card title="Mon GPS" help={record ? `Comparé à l'attendu de ton poste (${record.position.toLowerCase()}), ramené à un match de 70 min.` : undefined}>
            {!record
              ? <p aria-disabled="true" className="rounded-lg bg-field px-3 py-4 text-center text-sm text-ink/45">Pas de GPS pour toi sur ce match.</p>
              : (
                <>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ['Temps de jeu', `${record.minutes} min`, null],
                      ['Distance', `${record.distance_m.toLocaleString('fr-FR')} m`, analysis?.pct.distance],
                      ['Haute intensité (> 21 km/h)', `${record.hi_distance_m} m`, analysis?.pct.hi],
                      ['Accélérations', String(record.accelerations), analysis?.pct.accelerations],
                    ].map(([label, value, pct]) => (
                      <div key={String(label)} className="rounded-lg bg-field px-3 py-2">
                        <dt className="text-ink/60">{label}</dt>
                        <dd className="font-display text-xl font-semibold">{value}{pct != null && <span className={`ml-2 text-base ${Number(pct) >= 100 ? 'text-ok' : 'text-ink/60'}`}>{pct} %</span>}</dd>
                      </div>
                    ))}
                    <div className="rounded-lg bg-field px-3 py-2">
                      <dt className="text-ink/60">Vmax</dt>
                      <dd className="font-display text-xl font-semibold">{record.vmax ? `${String(record.vmax).replace('.', ',')} km/h` : '—'}
                        {vmax?.record && <span className="ml-2 text-base text-gold">record !</span>}
                        {vmax && !vmax.record && !vmax.first && vmax.pctOfBest !== null && <span className="ml-2 text-base text-ink/60">{vmax.pctOfBest} % de ton record</span>}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-field px-3 py-2">
                      <dt className="text-ink/60">Attendus remplis</dt>
                      <dd className="font-display text-xl font-semibold">
                        {analysis ? <MatchColor color={analysis.color} label={`${analysis.filled}/3`} /> : <span className="text-base text-ink/60">{ref ? `temps de jeu < ${MIN_MINUTES} min` : 'pas d\'attendu pour ce poste'}</span>}
                      </dd>
                    </div>
                  </dl>
                  {!ref && <p className="text-sm text-ink/60">Poste sans attendu au référentiel : pas de comparaison.</p>}
                </>
              )}
          </Card>
        </>
      )}
      <MyGoals playerId={playerId} date={today} title="Mes maxi et objectifs" />
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
          <li key={h.match.id} className={`flex flex-col items-center gap-1 rounded-lg bg-field px-1 py-2 ${h.analysis ? '' : 'opacity-50'}`}>
            {h.analysis ? <Coq color={h.analysis.color} className="h-9 w-9" /> : <span className="flex h-9 items-center text-ink/50">—</span>}
            <span className="font-semibold">{h.match.label ?? h.match.opponent}</span>
            <span className="text-ink/60">{h.analysis ? `${h.analysis.filled}/3` : h.record ? '< 20 min' : 'pas de GPS'}</span>
          </li>
        ))}
      </ul>
      {r.analysed > 0 ? (
        <dl className="grid grid-cols-3 gap-2 text-sm">
          {([['Distance', r.pcts.distance], ['Haute intensité', r.pcts.hi], ['Accélérations', r.pcts.accelerations]] as const).map(([label, pct]) => (
            <div key={label} className="rounded-lg bg-field px-2 py-2">
              <dt className="text-xs text-ink/60">{label}</dt>
              <dd className={`font-display text-xl font-semibold ${pct !== null && pct >= 100 ? 'text-ok' : ''}`}>{pct ?? '—'} %</dd>
            </div>
          ))}
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

import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { formatDay } from '../../lib/week'
import { fullName } from '../staff/load'
import { useRoster } from '../staff/useStaff'
import { COLOR_LABEL, GPS_COLORS, MIN_MINUTES, RATING_HEX, gpsAnalysis, positionGroup, vmaxTimeline } from './gps'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Check } from 'lucide-react'
import { StatCard } from '../staff/StatCard'
import { BRAND } from '../../lib/brand'
import { ClubLogo, Coq, MatchColor } from './MatchColor'
import { playerPhoto, useGpsRecords, useGpsReference, useMatches } from './usePerformance'

// Espace GPS (staff) : GPS d'un match et couleur GPS de chaque joueur, rapports PowerPoint. Les notes de match sont dans
// l'espace Match, sans lien avec les GPS (décision du 02/11/2026).
export function MatchBoard() {
  const matches = useMatches()
  const roster = useRoster()
  const gps = useGpsRecords()
  const reference = useGpsReference()
  const [matchId, setMatchId] = useState('')
  const [exporting, setExporting] = useState<'match' | 'player' | 'team' | null>(null)
  const [exportFailed, setExportFailed] = useState(false)
  const [playerId, setPlayerId] = useState('')
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [sort, setSort] = useState<Sort>('couleur')

  if (matches.isPending || roster.isPending || gps.isPending || reference.isPending) return <Loading />
  if (matches.isError || roster.isError || gps.isError || reference.isError) return <p role="alert">Impossible de charger les matchs.</p>
  const match = matches.data.find(m => m.id === matchId) ?? matches.data[0]
  if (!match) return <Card title="GPS"><p className="text-sm text-ink/70">Aucun match joué pour l'instant.</p></Card>

  const { refs, positions } = reference.data
  // PowerPoint créés au clic (pptxgenjs chargé seulement ici) ; module absent (hors ligne, nouvelle version) : message
  const run = async (kind: 'match' | 'player' | 'team', task: () => Promise<void>) => {
    setExporting(kind)
    setExportFailed(false)
    try { await task() } catch { setExportFailed(true) } finally { setExporting(null) }
  }
  const chrono = [...matches.data].reverse() // du plus ancien au plus récent, pour choisir un bloc
  const player = roster.data.find(p => p.id === playerId) ?? roster.data[0]
  const from = chrono.find(m => m.id === fromId) ?? chrono[0]
  const to = chrono.find(m => m.id === toId) ?? chrono.at(-1)!
  const block = chrono.filter(m => m.match_date >= from.match_date && m.match_date <= to.match_date)
  const dateOf = new Map(matches.data.map(m => [m.id, m.match_date]))
  const rows = roster.data.map(p => {
    const record = gps.data.find(g => g.match_id === match.id && g.player_id === p.id)
    const analysis = record ? gpsAnalysis(record, refs.get(positionGroup(record.position, positions) ?? '') ?? null) : null
    const vmax = vmaxTimeline(gps.data.filter(g => g.player_id === p.id).map(g => ({ date: dateOf.get(g.match_id) ?? '', vmax: g.vmax })))
      .find(v => v.date === match.match_date)
    return { player: p, record, analysis, vmax }
  })
  const withGps = rows.filter(r => r.record)
  const analysed = withGps.filter(r => r.analysis)
  const full = analysed.filter(r => r.analysis!.filled === 3).length, none = analysed.filter(r => r.analysis!.filled === 0).length
  const colors = GPS_COLORS.map(c => ({ color: c, label: COLOR_LABEL[c], n: analysed.filter(r => r.analysis!.color === c).length })).filter(c => c.n)
  const best = { distance: Math.max(0, ...withGps.map(r => r.record!.distance_m)), hi: Math.max(0, ...withGps.map(r => r.record!.hi_distance_m)),
    acc: Math.max(0, ...withGps.map(r => r.record!.accelerations)), vmax: Math.max(0, ...withGps.map(r => r.record!.vmax ?? 0)) }
  const topVmax = withGps.filter(r => r.record!.vmax != null).sort((a, b) => b.record!.vmax! - a.record!.vmax!).slice(0, 5)
  const fastest = topVmax[0]
  const key: Record<Sort, (r: typeof rows[number]) => number> = {
    couleur: r => (r.analysis?.filled ?? -1) * 1e6 + r.record!.distance_m, distance: r => r.record!.distance_m,
    hi: r => r.record!.hi_distance_m, acc: r => r.record!.accelerations, vmax: r => r.record!.vmax ?? 0,
  }
  const sorted = [...withGps].sort((a, b) => key[sort](b) - key[sort](a))
  // Tendances des cartes : moyennes de l'effectif match par match, jusqu'au match choisi (8 derniers)
  const avg = (v: number[]) => (v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null)
  const perMatch = (id: string) => {
    const recs = gps.data.filter(g => g.match_id === id)
    const v = recs.flatMap(g => (g.vmax != null ? [g.vmax] : []))
    return { n: recs.length, dist: avg(recs.map(g => g.distance_m)), hi: avg(recs.map(g => g.hi_distance_m)), vmax: v.length ? Math.max(...v) : null }
  }
  const upTo = chrono.filter(m => m.match_date <= match.match_date).slice(-8)
  const cur = perMatch(match.id), prevMatch = upTo.at(-2), prev = prevMatch ? perMatch(prevMatch.id) : null
  const series = (k: 'n' | 'dist' | 'hi' | 'vmax') => upTo.map(m => ({ day: m.label ?? m.opponent.slice(0, 10), value: perMatch(m.id)[k] }))

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <ViewSelect label="Match" value={match.id} onChange={setMatchId}>
          {matches.data.map(m => <option key={m.id} value={m.id}>{m.label ? `${m.label} · ` : ''}{m.opponent} · {formatDay(m.match_date)}</option>)}
        </ViewSelect>
        <Button variant="ghost" size="sm" disabled={!!exporting} onClick={() => run('match', async () => {
          const [{ matchReport }, { downloadMatchReport }] = await Promise.all([import('./report'), import('./exportPerformance')])
          const r = matchReport({ match, players: roster.data, records: gps.data, ref: reference.data, allRecords: gps.data, matches: matches.data })
          await downloadMatchReport(r, match, `Match_${match.match_date}_${match.opponent.replace(/\W+/g, '-')}.pptx`)
        })}>{exporting === 'match' ? 'Préparation…' : 'Rendu équipe (PowerPoint)'}</Button>
      </div>
      {exportFailed && <p role="alert" className="text-sm text-rnr">Création du fichier impossible : recharge la page et réessaie.</p>}
      {/* En-tête du match : adversaire, lecture en une phrase */}
      <header className="rise flex items-center gap-4">
        <ClubLogo match={match} className="h-14 w-14" />
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-3xl font-bold leading-tight">{match.label ? `${match.label} · ` : ''}{match.opponent}</h2>
          <p className="text-sm text-ink/60 first-letter:uppercase">{formatDay(match.match_date)}{match.home === null ? '' : match.home ? ' · domicile' : ' · extérieur'}</p>
        </div>
      </header>
      <p className="rise max-w-4xl leading-snug text-ink/80" style={{ animationDelay: '60ms' }}>
        <strong className="text-ink">{withGps.length} joueur{withGps.length > 1 ? 's' : ''} avec GPS</strong> sur {rows.length}.{' '}
        {analysed.length > 0 && <><strong className="text-ink">{full} joueur{full > 1 ? 's' : ''}</strong> remplissent les 3 attendus de leur poste, {none} aucun. </>}
        {fastest?.record?.vmax != null && <>Vmax du match : <strong className="text-ink">{fastest.record.vmax.toLocaleString('fr-FR')} km/h</strong> ({fullName(fastest.player)}{fastest.vmax?.record ? ', record personnel' : ''}).</>}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard deltaLabel="vs match préc." order={1} label="Joueurs avec GPS" value={withGps.length} suffix={` / ${rows.length}`} delta={prev ? cur.n - prev.n : null} trend={series('n')} color={BRAND.muted} />
        <StatCard deltaLabel="vs match préc." order={2} label="Distance moyenne" value={cur.dist ?? 0} suffix=" m" delta={prev && cur.dist !== null && prev.dist !== null ? cur.dist - prev.dist : null} trend={series('dist')} color={BRAND.ok} />
        <StatCard deltaLabel="vs match préc." order={3} label="Haute intensité moyenne" value={cur.hi ?? 0} suffix=" m" delta={prev && cur.hi !== null && prev.hi !== null ? cur.hi - prev.hi : null} trend={series('hi')} color={BRAND.gold} />
        <StatCard order={4} decimals={1} label="Vmax du match" value={cur.vmax ?? 0} suffix=" km/h" trend={series('vmax')} color={BRAND.rnr}
          hint={fastest ? fullName(fastest.player) : undefined} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rise min-w-0" style={{ animationDelay: '320ms' }}>
          <Card boxed title="GPS du match" help="Données brutes du boîtier. Barre : comparée au meilleur du match. En petit : % de l'attendu au poste (ramené à 70 min), coché quand il est atteint."
            aside={(
              <ViewSelect label="Trier par" value={sort} onChange={setSort}>
                <option value="couleur">Couleur GPS</option><option value="distance">Distance</option>
                <option value="hi">Haute intensité</option><option value="acc">Accélérations</option><option value="vmax">Vmax</option>
              </ViewSelect>
            )}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-ink/55">
                  <tr>{['Joueur', 'Min', 'Distance (m)', 'Haute int. (m)', 'Accél.', 'Vmax (km/h)', 'GPS'].map(h => <th key={h} className="py-2 pr-3 font-normal">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {sorted.map(({ player, record, analysis, vmax }) => (
                    <tr key={player.id} className="border-t border-line">
                      <td className="whitespace-nowrap py-1.5 pr-3"><span className="font-semibold">{fullName(player)}</span> <span className="text-xs text-ink/50">{record!.position.toLowerCase()}</span></td>
                      <td className="pr-3 tabular-nums">{record!.minutes}</td>
                      <td className="pr-3"><Metric value={record!.distance_m} max={best.distance} pct={analysis?.pct.distance} /></td>
                      <td className="pr-3"><Metric value={record!.hi_distance_m} max={best.hi} pct={analysis?.pct.hi} /></td>
                      <td className="pr-3"><Metric value={record!.accelerations} max={best.acc} pct={analysis?.pct.accelerations} /></td>
                      <td className="pr-3"><Metric value={record!.vmax} max={best.vmax} star={vmax?.record} /></td>
                      <td className="whitespace-nowrap pr-3">{analysis ? <MatchColor color={analysis.color} label={`${analysis.filled}/3`} /> : <span className="text-xs text-ink/50">{record!.minutes < MIN_MINUTES ? '< 20 min' : 'poste sans attendu'}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > withGps.length && <p className="text-xs text-ink/55">Sans GPS : {rows.filter(r => !r.record).map(r => fullName(r.player)).join(', ')}.</p>}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rise" style={{ animationDelay: '400ms' }}>
            <Card boxed title="Couleur GPS" help="Attendus du poste remplis sur 3 (distance, haute intensité, accélérations).">
              {colors.length ? (
                <div className="relative h-40">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={colors} dataKey="n" nameKey="label" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none" animationDuration={900}>
                        {colors.map(c => <Cell key={c.color} fill={RATING_HEX[c.color]} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [`${v} joueur${Number(v) > 1 ? 's' : ''}`, String(n)]}
                        contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 8, fontSize: 12 }} itemStyle={{ color: 'rgb(var(--ink))' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-3xl font-semibold leading-none tabular-nums">{analysed.length}</span>
                    <span className="text-xs text-ink/55">analysés</span>
                  </div>
                </div>
              ) : <p className="text-sm text-ink/60">Aucun joueur analysé (GPS absent ou moins de 20 min).</p>}
              <ul className="flex flex-col gap-1 text-sm">
                {GPS_COLORS.slice().reverse().map(c => (
                  <li key={c} className="flex items-center gap-2"><Coq color={c} /><span className="flex-1">{COLOR_LABEL[c]}</span>
                    <span className="tabular-nums text-ink/70">{analysed.filter(r => r.analysis!.color === c).length}</span></li>
                ))}
              </ul>
            </Card>
          </div>
          <div className="rise" style={{ animationDelay: '480ms' }}>
            <Card boxed title="Vmax du match" help="Les 5 plus rapides ; ★ : record personnel battu.">
              <ol className="flex flex-col">
                {topVmax.map((r, i) => (
                  <li key={r.player.id} className="flex items-center gap-3 border-t border-line py-1.5 text-sm first:border-t-0">
                    <span className="w-4 font-display font-semibold text-ink/50">{i + 1}</span>
                    <span className="flex-1 truncate font-semibold">{fullName(r.player)}</span>
                    <span className="tabular-nums">{r.record!.vmax!.toLocaleString('fr-FR')} km/h{r.vmax?.record && <span className="ml-1 text-gold" title="Record personnel">★</span>}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      </div>

      <Card boxed title="Bilans sur un bloc de matchs (PowerPoint)" help="Choisis le premier et le dernier match du bloc (ex. les 3 derniers). Individuel : un joueur, avec sa photo s'il en a une. Collectif : tout le groupe sur le bloc.">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <ViewSelect label="Joueur" value={player?.id ?? ''} onChange={setPlayerId}>
            {roster.data.map(p => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
          </ViewSelect>
          <ViewSelect label="Du" value={from.id} onChange={setFromId}>
            {chrono.map(m => <option key={m.id} value={m.id}>{m.label ? `${m.label} · ` : ''}{m.opponent}</option>)}
          </ViewSelect>
          <ViewSelect label="Au" value={to.id} onChange={setToId}>
            {chrono.map(m => <option key={m.id} value={m.id}>{m.label ? `${m.label} · ` : ''}{m.opponent}</option>)}
          </ViewSelect>
          <Button size="sm" disabled={!!exporting || !player || !block.length} onClick={() => run('player', async () => {
            const [{ playerReport }, { downloadPlayerReport }] = await Promise.all([import('./report'), import('./exportPerformance')])
            const r = playerReport({ player, matches: block, records: gps.data, ref: reference.data })
            const period = `${block.length} match${block.length > 1 ? 's' : ''} · ${formatDay(block[0].match_date)} → ${formatDay(block.at(-1)!.match_date)}`
            await downloadPlayerReport(r, player, period, `Bilan_GPS_${player.last_name}_${player.first_name}.pptx`, await playerPhoto(player.id))
          })}>{exporting === 'player' ? 'Préparation…' : 'Bilan individuel'}</Button>
          <Button variant="ghost" size="sm" disabled={!!exporting || !block.length} onClick={() => run('team', async () => {
            const [{ teamBlockReport }, { downloadTeamBlockReport }] = await Promise.all([import('./report'), import('./exportPerformance')])
            const r = teamBlockReport({ matches: block, players: roster.data, records: gps.data, ref: reference.data })
            await downloadTeamBlockReport(r, `Bloc_${block[0].match_date}_${block.at(-1)!.match_date}.pptx`)
          })}>{exporting === 'team' ? 'Préparation…' : 'Collectif du bloc'}</Button>
        </div>
        {!block.length && <p role="alert" className="text-sm text-rnr">Le premier match du bloc doit précéder le dernier.</p>}
      </Card>
    </>
  )
}

type Sort = 'couleur' | 'distance' | 'hi' | 'acc' | 'vmax'

// Valeur brute + barre comparée au meilleur du match ; % de l'attendu en petit, coché quand il est atteint
function Metric({ value, max, pct, star }: { value: number | null; max: number; pct?: number; star?: boolean }) {
  if (value == null) return <span className="text-ink/40">—</span>
  const ok = pct !== undefined && pct >= 100
  return (
    <span className="flex min-w-24 flex-col gap-1">
      <span className="flex items-baseline gap-1.5 tabular-nums">
        <span className="font-semibold">{value.toLocaleString('fr-FR')}</span>{star && <span className="text-gold" title="Record personnel">★</span>}
        {pct !== undefined && <span className={`inline-flex items-center text-xs ${ok ? 'text-ok' : 'text-ink/50'}`}>{ok && <Check size={12} aria-hidden="true" />}{pct} %</span>}
      </span>
      <span className="h-1 w-full rounded-full bg-field" aria-hidden="true">
        <span className={`block h-full rounded-full ${ok ? 'bg-ok' : 'bg-ink/45'}`} style={{ width: `${max ? Math.max(4, (100 * value) / max) : 0}%` }} />
      </span>
    </span>
  )
}

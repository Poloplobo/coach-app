import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { formatDay } from '../../lib/week'
import { fullName } from '../staff/load'
import { useRoster } from '../staff/useStaff'
import { COLOR_LABEL, GPS_COLORS, MIN_MINUTES, RATING_COLORS, gpsAnalysis, positionGroup, vmaxTimeline, type RatingColor } from './gps'
import { MatchColor } from './MatchColor'
import { playerPhoto, useGpsRecords, useGpsReference, useMatches, useRateMatch, useRatings } from './usePerformance'

// Vue staff d'un match : GPS et couleur GPS de chaque joueur, sa note et celle du staff (saisie ici)
export function MatchBoard() {
  const matches = useMatches()
  const roster = useRoster()
  const gps = useGpsRecords()
  const ratings = useRatings()
  const reference = useGpsReference()
  const rate = useRateMatch()
  const [matchId, setMatchId] = useState('')
  const [exporting, setExporting] = useState<'match' | 'player' | 'team' | null>(null)
  const [exportFailed, setExportFailed] = useState(false)
  const [playerId, setPlayerId] = useState('')
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')

  if (matches.isPending || roster.isPending || gps.isPending || ratings.isPending || reference.isPending) return <Loading />
  if (matches.isError || roster.isError || gps.isError || ratings.isError || reference.isError) return <p role="alert">Impossible de charger les matchs.</p>
  const match = matches.data.find(m => m.id === matchId) ?? matches.data[0]
  if (!match) return <Card title="Matchs"><p className="text-sm text-ink/70">Aucun match : importe les GPS d'un match (menu Afficher).</p></Card>

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
    const note = (rater: 'player' | 'staff') => ratings.data.find(r => r.match_id === match.id && r.player_id === p.id && r.rater === rater)?.color ?? null
    return { player: p, record, analysis, vmax, own: note('player'), staff: note('staff') }
  })
  const withGps = rows.filter(r => r.record)
  const count = (pick: (r: typeof rows[number]) => RatingColor | null | undefined) =>
    GPS_COLORS.map(c => `${rows.filter(r => pick(r) === c).length} ${c}`).join(', ')

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <ViewSelect label="Match" value={match.id} onChange={setMatchId}>
          {matches.data.map(m => <option key={m.id} value={m.id}>{m.label ? `${m.label} · ` : ''}{m.opponent} · {formatDay(m.match_date)}</option>)}
        </ViewSelect>
        <Button variant="ghost" size="sm" disabled={!!exporting} onClick={() => run('match', async () => {
          const [{ matchReport }, { downloadMatchReport }] = await Promise.all([import('./report'), import('./exportPerformance')])
          const r = matchReport({ match, players: roster.data, records: gps.data, ratings: ratings.data, ref: reference.data, allRecords: gps.data, matches: matches.data })
          await downloadMatchReport(r, match, `Match_${match.match_date}_${match.opponent.replace(/\W+/g, '-')}.pptx`)
        })}>{exporting === 'match' ? 'Préparation…' : 'Rendu équipe (PowerPoint)'}</Button>
      </div>
      {exportFailed && <p role="alert" className="text-sm text-rnr">Création du fichier impossible : recharge la page et réessaie.</p>}
      <p className="text-sm">
        {withGps.length} joueur{withGps.length > 1 ? 's' : ''} avec GPS · couleur GPS : {count(r => r.analysis?.color)} ·
        notes joueurs : {rows.filter(r => r.own).length}/{rows.length} · notes staff : {rows.filter(r => r.staff).length}/{rows.length}
      </p>
      <Card title={`${match.opponent} — ${formatDay(match.match_date)}`}
        help="% de l'attendu au poste du match, ramené à 70 min ; couleur GPS = attendus remplis sur 3. La note du joueur et la tienne sont indépendantes du GPS ; le joueur ne voit ta note qu'après s'être noté.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink/60">
              <tr>{['Joueur', 'Poste', 'Min', 'Distance', 'DHI', 'Accél.', 'Vmax', 'GPS', 'Note joueur', 'Note staff'].map(h => <th key={h} className="py-2 pr-3 font-normal">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(({ player, record, analysis, vmax, own, staff }) => (
                <tr key={player.id} className="border-t border-line">
                  <td className="py-2 pr-3 font-semibold whitespace-nowrap">{fullName(player)}</td>
                  {record ? (
                    <>
                      <td className="pr-3 whitespace-nowrap">{record.position.toLowerCase()}</td>
                      <td className="pr-3">{record.minutes}</td>
                      <td className="pr-3 whitespace-nowrap">{record.distance_m.toLocaleString('fr-FR')} m{analysis && <span className="text-ink/60"> · {analysis.pct.distance} %</span>}</td>
                      <td className="pr-3 whitespace-nowrap">{record.hi_distance_m} m{analysis && <span className="text-ink/60"> · {analysis.pct.hi} %</span>}</td>
                      <td className="pr-3 whitespace-nowrap">{record.accelerations}{analysis && <span className="text-ink/60"> · {analysis.pct.accelerations} %</span>}</td>
                      <td className="pr-3 whitespace-nowrap">{record.vmax ?? '—'}{vmax?.record && <span className="text-gold font-semibold"> record</span>}</td>
                      <td className="pr-3 whitespace-nowrap">{analysis ? <MatchColor color={analysis.color} label={`${analysis.filled}/3`} /> : <span className="text-ink/50">{record.minutes < MIN_MINUTES ? '< 20 min' : 'poste sans attendu'}</span>}</td>
                    </>
                  ) : <td colSpan={7} className="pr-3 text-ink/40">pas de GPS</td>}
                  <td className="pr-3 whitespace-nowrap">{own ? <MatchColor color={own} /> : <span className="text-ink/50">—</span>}</td>
                  <td>
                    <select aria-label={`Note staff pour ${fullName(player)}`} value={staff ?? ''} disabled={rate.isPending}
                      onChange={e => e.target.value && rate.mutate({ match_id: match.id, player_id: player.id, rater: 'staff', color: e.target.value as RatingColor })}
                      className="rounded-md bg-field border border-line px-2 py-1">
                      <option value="">—</option>
                      {RATING_COLORS.map(c => <option key={c} value={c}>{c === 'gris' ? 'gris · n\'a pas joué' : `${c} · ${COLOR_LABEL[c].toLowerCase()}`}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rate.isError && <p role="alert" className="text-sm text-rnr">Note non enregistrée, réessaie.</p>}
      </Card>
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
            const r = playerReport({ player, matches: block, records: gps.data, ratings: ratings.data, ref: reference.data })
            const period = `${block.length} match${block.length > 1 ? 's' : ''} · ${formatDay(block[0].match_date)} → ${formatDay(block.at(-1)!.match_date)}`
            await downloadPlayerReport(r, player, period, `Bilan_GPS_${player.last_name}_${player.first_name}.pptx`, await playerPhoto(player.id))
          })}>{exporting === 'player' ? 'Préparation…' : 'Bilan individuel'}</Button>
          <Button variant="ghost" size="sm" disabled={!!exporting || !block.length} onClick={() => run('team', async () => {
            const [{ teamBlockReport }, { downloadTeamBlockReport }] = await Promise.all([import('./report'), import('./exportPerformance')])
            const r = teamBlockReport({ matches: block, players: roster.data, records: gps.data, ratings: ratings.data, ref: reference.data })
            await downloadTeamBlockReport(r, `Bloc_${block[0].match_date}_${block.at(-1)!.match_date}.pptx`)
          })}>{exporting === 'team' ? 'Préparation…' : 'Collectif du bloc'}</Button>
        </div>
        {!block.length && <p role="alert" className="text-sm text-rnr">Le premier match du bloc doit précéder le dernier.</p>}
      </Card>
    </>
  )
}

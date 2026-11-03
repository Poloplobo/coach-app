import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { BRAND } from '../../lib/brand'
import { formatDay } from '../../lib/week'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { fullName } from '../staff/load'
import { useRoster } from '../staff/useStaff'
import { GPS_COLORS, RATING_COLORS, RATING_HEX, RATING_LABEL, RATING_SCORE, ratingSeason, type RatingColor } from './gps'
import { ClubLogo, Coq, MatchColor } from './MatchColor'
import { useMatches, useRateMatch, useRatings, type Match, type Rating } from './usePerformance'

// Espace Match (staff) : tous les matchs joués avec leurs coqs ; un match choisi, une note et un commentaire par joueur.
// Sans lien avec les GPS. Le joueur ne voit la note et le commentaire du coach qu'après avoir validé la sienne (RLS).
export function MatchNotes() {
  const matches = useMatches()
  const roster = useRoster()
  const ratings = useRatings()
  const [matchId, setMatchId] = useState('')

  if (matches.isPending || roster.isPending || ratings.isPending) return <Loading />
  if (matches.isError || roster.isError || ratings.isError) return <p role="alert">Impossible de charger les matchs.</p>
  if (!matches.data.length) return <Card title="Matchs"><p className="text-sm text-ink/70">Aucun match joué pour l'instant (calendrier à importer).</p></Card>
  const match = matches.data.find(m => m.id === matchId)
  const of = (m: string, rater: Rating['rater']) => ratings.data.filter(r => r.match_id === m && r.rater === rater)

  if (match) return <MatchRating match={match} players={roster.data} ratings={ratings.data.filter(r => r.match_id === match.id)} onBack={() => setMatchId('')} />
  return (
    <Card title="Matchs joués" help="Coqs donnés par le staff à chaque match. Choisis un match pour noter les joueurs (coq et commentaire).">
      <ul className="flex flex-col divide-y divide-line">
        {matches.data.map(m => {
          const staff = of(m.id, 'staff')
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
              <ClubLogo match={m} />
              <span className="min-w-56 font-semibold">{m.label ? `${m.label} · ` : ''}{m.opponent}
                <span className="block text-xs font-normal text-ink/60">{formatDay(m.match_date)}{m.home === null ? '' : m.home ? ' · domicile' : ' · extérieur'}</span>
              </span>
              <span className="flex items-center gap-3 text-sm">
                {RATING_COLORS.map(c => {
                  const n = staff.filter(r => r.color === c).length
                  return n ? <span key={c} className="flex items-center gap-1"><Coq color={c} />{n}</span> : null
                })}
                {!staff.length && <span className="text-ink/50">pas encore noté</span>}
              </span>
              <span className="text-xs text-ink/60">{of(m.id, 'player').length} joueur{of(m.id, 'player').length > 1 ? 's' : ''} noté{of(m.id, 'player').length > 1 ? 's' : ''}</span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setMatchId(m.id)}>{staff.length ? 'Voir et modifier' : 'Noter'}</Button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

type Player = { id: string; first_name: string; last_name: string }

function MatchRating({ match, players, ratings, onBack }: { match: Match; players: Player[]; ratings: Rating[]; onBack: () => void }) {
  return (
    <Card title={`${match.label ? `${match.label} · ` : ''}${match.opponent} — ${formatDay(match.match_date)}`}
      help="Un coq et un commentaire par joueur ; enregistré joueur par joueur. Le joueur les découvre après avoir validé sa propre note."
      aside={<Button size="sm" variant="ghost" onClick={onBack}>← Tous les matchs</Button>}>
      <ul className="flex flex-col divide-y divide-line">
        {players.map(p => (
          <PlayerRating key={p.id} matchId={match.id} player={p} name={fullName(p)} ariaName={fullName(p)}
            own={ratings.find(r => r.player_id === p.id && r.rater === 'player') ?? null}
            staff={ratings.find(r => r.player_id === p.id && r.rater === 'staff') ?? null} />
        ))}
      </ul>
    </Card>
  )
}

// Une note du coach : coq, temps de jeu et commentaire d'un joueur sur un match (nommé par le joueur ou par le match)
function PlayerRating({ matchId, player, name, ariaName, own, staff }: { matchId: string; player: Player; name: string; ariaName: string; own: Rating | null; staff: Rating | null }) {
  const rate = useRateMatch()
  const [color, setColor] = useState<RatingColor | null>(staff?.color ?? null)
  const [comment, setComment] = useState(staff?.comment ?? '')
  const [minutes, setMinutes] = useState(staff?.minutes?.toString() ?? '')
  const playTime = minutes.trim() === '' ? null : Number(minutes) // saisie non numérique : NaN, refusée ci-dessous
  const validTime = playTime === null || (Number.isInteger(playTime) && playTime >= 0 && playTime <= 120)
  // « N'a pas joué » avec des minutes, ou une note avec 0 min : le résumé et la courbe se contrediraient
  const coherent = playTime === null || !color || (color === 'gris') === (playTime === 0)
  const changed = color !== (staff?.color ?? null) || comment.trim() !== (staff?.comment ?? '') || playTime !== (staff?.minutes ?? null)
  return (
    <li className="flex flex-col gap-2 py-3 lg:flex-row lg:items-start lg:gap-4">
      <div className="lg:w-56">
        <p className="font-semibold">{name}</p>
        <p className="text-xs text-ink/60">Sa note : {own ? <MatchColor color={own.color} label={RATING_LABEL[own.color]} /> : 'pas encore notée'}</p>
      </div>
      <div role="radiogroup" aria-label={`Note du coach : ${ariaName}`} className="flex flex-wrap gap-1.5">
        {RATING_COLORS.map(c => (
          <button key={c} type="button" role="radio" aria-checked={color === c} onClick={() => { setColor(c); if (c === 'gris') setMinutes('0') }} title={RATING_LABEL[c]}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold ${color === c ? 'border-ink bg-field' : 'border-line opacity-70'}`}>
            <Coq color={c} className="h-6 w-6" />{RATING_LABEL[c]}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-xs text-ink/70">
        Temps de jeu (min)
        <input type="number" inputMode="numeric" min={0} max={120} value={minutes} onChange={e => setMinutes(e.target.validity.badInput ? 'x' : e.target.value)}
          aria-invalid={!validTime} className="w-20 rounded-lg bg-field border border-line px-2 py-1.5 text-base text-ink" />
      </label>
      <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm">
        <span className="sr-only">Commentaire : {ariaName}</span>
        <textarea value={comment} rows={2} maxLength={500} onChange={e => setComment(e.target.value)} placeholder="Commentaire (facultatif)"
          className="rounded-lg bg-field border border-line px-3 py-2 text-base" />
      </label>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!color || !changed || !validTime || !coherent || rate.isPending}
          onClick={() => color && rate.mutate({ match_id: matchId, player_id: player.id, rater: 'staff', color, comment: comment.trim() || null, minutes: playTime })}>
          {rate.isPending ? '…' : 'Enregistrer'}
        </Button>
        {rate.isSuccess && !changed && <span role="status" className="text-xs text-ink/60">Enregistré</span>}
        {rate.isError && <span role="alert" className="text-xs text-rnr">Non enregistré</span>}
        {!validTime && <span role="alert" className="text-xs text-rnr">Temps de jeu : 0 à 120 min</span>}
        {validTime && !coherent && <span role="alert" className="text-xs text-rnr">{color === 'gris' ? 'N\'a pas joué : 0 min' : 'Avec une note, le temps de jeu est d\'au moins 1 min'}</span>}
        {!color && changed && <span className="text-xs text-ink/60">Choisis d'abord un coq</span>}
      </div>
    </li>
  )
}

// Un joueur sur l'année : courbe des notes du coach et du joueur, temps de jeu, puis chaque match à noter ou corriger
export function PlayerSeason() {
  const matches = useMatches()
  const roster = useRoster()
  const ratings = useRatings()
  const [playerId, setPlayerId] = useState('')

  if (matches.isPending || roster.isPending || ratings.isPending) return <Loading />
  if (matches.isError || roster.isError || ratings.isError) return <p role="alert">Impossible de charger les notes.</p>
  const player = roster.data.find(p => p.id === playerId) ?? roster.data[0]
  if (!player) return <p className="text-sm text-ink/70">Aucun joueur dans l'effectif.</p>
  if (!matches.data.length) return <Card title="Notes de la saison"><p className="text-sm text-ink/70">Aucun match joué pour l'instant (calendrier à importer).</p></Card>
  const season = ratingSeason(matches.data, ratings.data, player.id)
  const played = season.filter(s => s.staffColor && s.staffColor !== 'gris')
  const timed = season.filter(s => s.minutes)
  const total = timed.reduce((n, s) => n + (s.minutes ?? 0), 0)
  const label = (score: number) => RATING_LABEL[GPS_COLORS.find(c => RATING_SCORE[c] === score)!]
  const colorDot = (key: 'staffColor' | 'playerColor', hollow: boolean) => (props: { cx?: number; cy?: number; index?: number }) => {
    const c = season[props.index ?? -1]?.[key]
    if (!c || c === 'gris' || props.cx == null || props.cy == null) return <g key={`${key}-${props.index}`} />
    const fill = RATING_HEX[c]
    return <circle key={`${key}-${props.index}`} cx={props.cx} cy={props.cy} r={hollow ? 5 : 6} fill={hollow ? 'none' : fill} stroke={fill} strokeWidth={hollow ? 2.5 : 0} />
  }

  return (
    <>
      <ViewSelect label="Joueur" value={player.id} onChange={setPlayerId}>
        {roster.data.map(p => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
      </ViewSelect>
      <Card title={`${fullName(player)} — notes de la saison`}
        help="Point plein : note du coach. Rond vide : note du joueur. La couleur du point est celle du coq ; « n'a pas joué » ne figure pas sur la courbe.">
        <p className="text-sm">
          {season.filter(s => s.staffColor).length} / {season.length} match{season.length > 1 ? 's' : ''} noté{season.length > 1 ? 's' : ''} par le coach
          · {played.length} match{played.length > 1 ? 's' : ''} joué{played.length > 1 ? 's' : ''}
          {' · '}{total} min de jeu{timed.length > 0 && ` sur ${timed.length} match${timed.length > 1 ? 's' : ''} saisi${timed.length > 1 ? 's' : ''} (moyenne ${Math.round(total / timed.length)} min)`}
        </p>
        {season.length > 0 && (
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={season} margin={{ top: 10, right: 16 }}>
                <CartesianGrid strokeOpacity={0.15} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'currentColor', fontSize: 11 }} angle={-35} textAnchor="end" height={60} />
                <YAxis domain={[1, 4]} ticks={[1, 2, 3, 4]} tickFormatter={label} tick={{ fill: 'currentColor', fontSize: 11 }} width={104} />
                <Tooltip formatter={(v, name) => [label(Number(v)), name]}
                  labelFormatter={(_, p) => { const s = p?.[0]?.payload as typeof season[number] | undefined
                    return s ? `${s.match.opponent} · ${formatDay(s.match.match_date)}${s.minutes !== null ? ` · ${s.minutes} min` : ''}` : '' }} />
                <Legend />
                <Line dataKey="staff" name="Coach" legendType="plainline" stroke={BRAND.muted} strokeWidth={2} connectNulls dot={colorDot('staffColor', false)} isAnimationActive={false} />
                <Line dataKey="player" name="Joueur" legendType="plainline" stroke={BRAND.muted} strokeDasharray="5 4" connectNulls dot={colorDot('playerColor', true)} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <Card title="Match par match" help="Coq, temps de jeu et commentaire du coach. Le joueur les découvre après avoir validé sa propre note.">
        <ul className="flex flex-col divide-y divide-line">
          {[...season].reverse().map(({ match: m }) => (
            <PlayerRating key={`${player.id}-${m.id}`} matchId={m.id} player={player}
              name={`${m.label ? `${m.label} · ` : ''}${m.opponent} — ${formatDay(m.match_date)}`}
              ariaName={`${fullName(player)}, ${m.label ? `${m.label} · ` : ''}${m.opponent} — ${formatDay(m.match_date)}`}
              own={ratings.data.find(r => r.match_id === m.id && r.player_id === player.id && r.rater === 'player') ?? null}
              staff={ratings.data.find(r => r.match_id === m.id && r.player_id === player.id && r.rater === 'staff') ?? null} />
          ))}
        </ul>
      </Card>
    </>
  )
}

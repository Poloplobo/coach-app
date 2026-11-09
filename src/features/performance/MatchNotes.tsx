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
import { StatCard } from '../staff/StatCard'
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
    <Card title="Matchs joués" help="Barre : coqs donnés par le coach. Choisis un match pour noter les joueurs (coq, temps de jeu, commentaire).">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {matches.data.map((m, i) => {
          const staff = of(m.id, 'staff')
          return (
            <li key={m.id} className="rise" style={{ animationDelay: `${i * 50}ms` }}>
              <div className={`flex h-full flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ${staff.length ? 'ring-line/60' : 'ring-rnr/50'}`}>
                <div className="flex items-center gap-3">
                  <ClubLogo match={m} className="h-11 w-11" />
                  <div className="min-w-0">
                    <p className="truncate font-display text-xl font-semibold leading-tight">{m.label ? `${m.label} · ` : ''}{m.opponent}</p>
                    <p className="text-xs text-ink/60 first-letter:uppercase">{formatDay(m.match_date)}{m.home === null ? '' : m.home ? ' · domicile' : ' · extérieur'}</p>
                  </div>
                </div>
                <CoqBar ratings={staff} total={roster.data.length} />
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="text-xs text-ink/60">{staff.length}/{roster.data.length} notés par le coach · {of(m.id, 'player').length} par les joueurs</span>
                  <Button size="sm" variant={staff.length ? 'ghost' : 'primary'} onClick={() => setMatchId(m.id)}>{staff.length ? 'Voir et modifier' : 'Noter'}</Button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

// Répartition des coqs du coach : une barre empilée (taille = nombre de joueurs), le reste en gris clair = pas encore noté
function CoqBar({ ratings, total }: { ratings: Rating[]; total: number }) {
  if (!ratings.length) return <p className="text-sm text-ink/50">Pas encore noté.</p>
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-field" role="img"
        aria-label={RATING_COLORS.map(c => `${ratings.filter(r => r.color === c).length} ${RATING_LABEL[c].toLowerCase()}`).join(', ')}>
        {RATING_COLORS.map(c => {
          const n = ratings.filter(r => r.color === c).length
          return n ? <span key={c} style={{ width: `${(100 * n) / Math.max(total, ratings.length)}%`, background: RATING_HEX[c] }} /> : null
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {RATING_COLORS.map(c => {
          const n = ratings.filter(r => r.color === c).length
          return n ? <span key={c} className="flex items-center gap-1" title={RATING_LABEL[c]}><Coq color={c} className="h-4 w-4" />{n}</span> : null
        })}
      </div>
    </div>
  )
}

type Player = { id: string; first_name: string; last_name: string }

function MatchRating({ match, players, ratings, onBack }: { match: Match; players: Player[]; ratings: Rating[]; onBack: () => void }) {
  const staff = ratings.filter(r => r.rater === 'staff')
  const both = players.filter(p => ratings.some(r => r.player_id === p.id && r.rater === 'staff') && ratings.some(r => r.player_id === p.id && r.rater === 'player'))
  const agree = both.filter(p => ratings.find(r => r.player_id === p.id && r.rater === 'staff')!.color === ratings.find(r => r.player_id === p.id && r.rater === 'player')!.color)
  return (
    <Card title={`${match.label ? `${match.label} · ` : ''}${match.opponent} — ${formatDay(match.match_date)}`}
      help="Un coq, le temps de jeu et un commentaire par joueur, puis Enregistrer. Le joueur les découvre après avoir validé sa propre note."
      aside={<Button size="sm" variant="ghost" onClick={onBack}>← Tous les matchs</Button>}>
      <div className="grid gap-4 rounded-xl bg-field p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
        <CoqBar ratings={staff} total={players.length} />
        <p className="text-sm"><strong className="font-display text-2xl tabular-nums">{staff.length}/{players.length}</strong> <span className="text-ink/60">notés</span></p>
        <p className="text-sm" title="Joueurs notés par eux-mêmes et par le coach : même coq">
          <strong className="font-display text-2xl tabular-nums">{both.length ? `${agree.length}/${both.length}` : '—'}</strong> <span className="text-ink/60">d'accord avec le joueur</span>
        </p>
      </div>
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
  // Une note de couleur suppose d'avoir joué ; « pas évaluable » (gris) accepte 0 min comme quelques minutes
  const coherent = playTime === null || !color || color === 'gris' || playTime > 0
  const changed = color !== (staff?.color ?? null) || comment.trim() !== (staff?.comment ?? '') || playTime !== (staff?.minutes ?? null)
  return (
    // Une ligne par joueur : nom et sa note | 5 coqs (libellé du coq choisi) | temps de jeu | commentaire | Enregistrer
    <li className="flex flex-col gap-2 py-2.5 xl:grid xl:grid-cols-[16rem_auto_5.5rem_minmax(0,1fr)_auto] xl:items-center xl:gap-4">
      <div className="min-w-0">
        <p className="truncate font-semibold">{name}</p>
        <p className="text-xs text-ink/60">Sa note : {own ? <MatchColor color={own.color} label={RATING_LABEL[own.color]} /> : 'pas encore notée'}</p>
        {own?.comment && <p className="text-xs italic text-ink/70">« {own.comment} »</p>}
      </div>
      <div className="flex items-center gap-2">
        <div role="radiogroup" aria-label={`Note du coach : ${ariaName}`} className="flex gap-1">
          {RATING_COLORS.map(c => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={RATING_LABEL[c]} title={RATING_LABEL[c]}
              onClick={() => setColor(c)}
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform active:scale-95 ${color === c ? 'scale-110 bg-field' : 'border-transparent opacity-45 hover:opacity-100'}`}
              style={color === c ? { borderColor: RATING_HEX[c] } : undefined}>
              <Coq color={c} className="h-6 w-6" />
            </button>
          ))}
        </div>
        <span className="w-28 text-xs font-semibold leading-tight" style={color ? { color: RATING_HEX[color] } : undefined}>{color ? RATING_LABEL[color] : <span className="font-normal text-ink/40">Choisir un coq</span>}</span>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink/70 xl:flex-col xl:items-start xl:gap-0.5">
        <span className="xl:sr-only">Temps de jeu (min)</span>
        <input type="number" inputMode="numeric" min={0} max={120} value={minutes} onChange={e => setMinutes(e.target.validity.badInput ? 'x' : e.target.value)}
          aria-invalid={!validTime} placeholder="min" className="w-20 rounded-lg bg-field border border-line px-2 py-1.5 text-base text-ink" />
      </label>
      <label className="flex min-w-0 flex-col text-sm">
        <span className="sr-only">Commentaire : {ariaName}</span>
        <textarea value={comment} rows={1} maxLength={500} onChange={e => setComment(e.target.value)} placeholder="Commentaire (facultatif)"
          className="min-h-10 resize-y rounded-lg bg-field border border-line px-3 py-2 text-base" />
      </label>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!color || !changed || !validTime || !coherent || rate.isPending}
          onClick={() => color && rate.mutate({ match_id: matchId, player_id: player.id, rater: 'staff', color, comment: comment.trim() || null, minutes: playTime })}>
          {rate.isPending ? '…' : 'Enregistrer'}
        </Button>
        {rate.isSuccess && !changed && <span role="status" className="text-xs text-ink/60">Enregistré</span>}
        {rate.isError && <span role="alert" className="text-xs text-rnr">Non enregistré</span>}
        {!validTime && <span role="alert" className="text-xs text-rnr">Temps de jeu : 0 à 120 min</span>}
        {validTime && !coherent && <span role="alert" className="text-xs text-rnr">Avec une note de couleur, le temps de jeu est d'au moins 1 min</span>}
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
  // Cartes : note moyenne du coach (1 à 4) et accord coach / joueur sur les matchs notés par les deux
  const scored = season.filter(s => s.staff != null)
  const meanScore = scored.length ? scored.reduce((n, s) => n + s.staff!, 0) / scored.length : null
  const both = season.filter(s => s.staffColor && s.playerColor)
  const agree = both.filter(s => s.staffColor === s.playerColor).length
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard order={1} label="Matchs évalués" value={played.length} suffix={` / ${season.length}`} color={BRAND.muted} hint="Matchs avec un coq de couleur du coach (hors « pas évaluable »)." />
        <StatCard order={2} label="Temps de jeu moyen" value={timed.length ? Math.round(total / timed.length) : 0} suffix=" min" color={BRAND.ok}
          trend={season.map(s => ({ day: s.name, value: s.minutes }))} />
        <StatCard order={3} decimals={1} label="Note moyenne du coach" value={meanScore ?? 0} suffix=" / 4" color={BRAND.gold}
          trend={season.map(s => ({ day: s.name, value: s.staff }))} hint={meanScore === null ? 'Pas encore noté.' : undefined} />
        <StatCard order={4} label="D'accord avec le joueur" value={both.length ? Math.round((100 * agree) / both.length) : 0} suffix=" %" color={BRAND.blue}
          hint={both.length ? `${agree} match${agree > 1 ? 's' : ''} sur ${both.length} notés par les deux.` : 'Aucun match noté par les deux.'} />
      </div>
      <Card title={`${fullName(player)} — notes de la saison`}
        help="Point plein : note du coach. Rond vide : note du joueur. La couleur du point est celle du coq ; « pas évaluable » ne figure pas sur la courbe.">
        <p className="text-sm">
          {season.filter(s => s.staffColor).length} / {season.length} match{season.length > 1 ? 's' : ''} noté{season.length > 1 ? 's' : ''} par le coach
          · {played.length} match{played.length > 1 ? 's' : ''} évalué{played.length > 1 ? 's' : ''}
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

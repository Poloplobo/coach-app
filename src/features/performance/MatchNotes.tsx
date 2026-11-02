import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { formatDay } from '../../lib/week'
import { fullName } from '../staff/load'
import { useRoster } from '../staff/useStaff'
import { RATING_COLORS, RATING_LABEL, type RatingColor } from './gps'
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
          <PlayerRating key={p.id} matchId={match.id} player={p}
            own={ratings.find(r => r.player_id === p.id && r.rater === 'player') ?? null}
            staff={ratings.find(r => r.player_id === p.id && r.rater === 'staff') ?? null} />
        ))}
      </ul>
    </Card>
  )
}

function PlayerRating({ matchId, player, own, staff }: { matchId: string; player: Player; own: Rating | null; staff: Rating | null }) {
  const rate = useRateMatch()
  const [color, setColor] = useState<RatingColor | null>(staff?.color ?? null)
  const [comment, setComment] = useState(staff?.comment ?? '')
  const changed = color !== (staff?.color ?? null) || comment.trim() !== (staff?.comment ?? '')
  return (
    <li className="flex flex-col gap-2 py-3 lg:flex-row lg:items-start lg:gap-4">
      <div className="lg:w-56">
        <p className="font-semibold">{fullName(player)}</p>
        <p className="text-xs text-ink/60">Sa note : {own ? <MatchColor color={own.color} label={RATING_LABEL[own.color]} /> : 'pas encore notée'}</p>
      </div>
      <div role="radiogroup" aria-label={`Note du coach pour ${fullName(player)}`} className="flex flex-wrap gap-1.5">
        {RATING_COLORS.map(c => (
          <button key={c} type="button" role="radio" aria-checked={color === c} onClick={() => setColor(c)} title={RATING_LABEL[c]}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold ${color === c ? 'border-ink bg-field' : 'border-line opacity-70'}`}>
            <Coq color={c} className="h-6 w-6" />{RATING_LABEL[c]}
          </button>
        ))}
      </div>
      <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm">
        <span className="sr-only">Commentaire pour {fullName(player)}</span>
        <textarea value={comment} rows={2} maxLength={500} onChange={e => setComment(e.target.value)} placeholder="Commentaire (facultatif)"
          className="rounded-lg bg-field border border-line px-3 py-2 text-base" />
      </label>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!color || !changed || rate.isPending}
          onClick={() => color && rate.mutate({ match_id: matchId, player_id: player.id, rater: 'staff', color, comment: comment.trim() || null })}>
          {rate.isPending ? '…' : 'Enregistrer'}
        </Button>
        {rate.isSuccess && !changed && <span role="status" className="text-xs text-ink/60">Enregistré</span>}
        {rate.isError && <span role="alert" className="text-xs text-rnr">Non enregistré</span>}
      </div>
    </li>
  )
}

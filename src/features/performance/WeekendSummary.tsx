import { ChevronRight } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { TabLink } from '../../components/ui/TabLink'
import { formatDay } from '../../lib/week'
import { RATING_LABEL, gpsAnalysis, positionGroup } from './gps'
import { ClubLogo, MatchColor } from './MatchColor'
import { useGpsRecords, useGpsReference, useMatches, useRatings } from './usePerformance'

// Accueil : son dernier match (sa note, puis celle du coach et son temps de jeu une fois la sienne donnée, RLS) et son
// GPS du week-end en bref ; le détail et la notation restent dans l'onglet Performance
export function WeekendSummary({ playerId }: { playerId: string }) {
  const matches = useMatches()
  const ratings = useRatings(playerId)
  const gps = useGpsRecords(playerId)
  const reference = useGpsReference()
  const match = matches.data?.[0]
  if (!match || !ratings.data || !gps.data || !reference.data) return null
  const own = ratings.data.find(r => r.match_id === match.id && r.rater === 'player')
  // La RLS ne rend la note du coach qu'après celle du joueur ; l'écran ne s'y fie pas seul
  const staff = own ? ratings.data.find(r => r.match_id === match.id && r.rater === 'staff') : undefined
  const record = gps.data.find(g => g.match_id === match.id)
  const ref = record ? reference.data.refs.get(positionGroup(record.position, reference.data.positions) ?? '') ?? null : null
  const analysis = record ? gpsAnalysis(record, ref) : null

  return (
    <Card title="Mon dernier match">
      <p className="flex items-center gap-3 font-semibold"><ClubLogo match={match} className="h-8 w-8" />
        <span>{match.label ? `${match.label} · ` : ''}{match.opponent}<span className="block text-sm font-normal text-ink/60">{formatDay(match.match_date)}</span></span>
      </p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-field px-3 py-2"><dt className="text-ink/60">Ma note</dt>
          <dd>{own ? <MatchColor color={own.color} label={RATING_LABEL[own.color]} /> : 'à donner'}</dd></div>
        <div className="rounded-lg bg-field px-3 py-2"><dt className="text-ink/60">Le coach</dt>
          <dd>{!own ? 'après ta note' : staff ? <MatchColor color={staff.color} label={RATING_LABEL[staff.color]} /> : 'pas encore'}</dd></div>
        {staff?.minutes != null && <div className="rounded-lg bg-field px-3 py-2"><dt className="text-ink/60">Temps de jeu</dt><dd className="font-semibold">{staff.minutes} min</dd></div>}
        {record && (
          <div className="rounded-lg bg-field px-3 py-2"><dt className="text-ink/60">GPS</dt>
            <dd>{analysis ? <MatchColor color={analysis.color} label={`${analysis.filled}/3 attendus`} /> : `${record.distance_m.toLocaleString('fr-FR')} m`}</dd></div>
        )}
      </dl>
      {staff?.comment && <p className="rounded-lg bg-field px-3 py-2 text-sm">« {staff.comment} »</p>}
      <TabLink to="/joueur/performance" className="flex items-center justify-between rounded-lg px-1 py-1 text-sm font-semibold text-gold">
        {own ? 'Voir le détail' : 'Noter mon match'}<ChevronRight size={18} aria-hidden="true" />
      </TabLink>
    </Card>
  )
}

import { ChevronRight } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { TabLink } from '../../components/ui/TabLink'
import { formatDay } from '../../lib/week'
import { RATING_LABEL, gpsAnalysis, positionGroup, type RatingColor } from './gps'
import { ClubLogo, Coq } from './MatchColor'
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
      {/* Même face-à-face que l'onglet Performance, en petit : ma note, le coach, le GPS */}
      <dl className="grid grid-cols-3 gap-2 text-center text-sm">
        <Cell label="Ma note" color={own?.color} text={own ? RATING_LABEL[own.color] : 'à donner'} />
        <Cell label="Le coach" color={staff?.color} text={!own ? 'après ta note' : staff ? RATING_LABEL[staff.color] : 'pas encore'} />
        {record
          ? <Cell label="GPS" color={analysis?.color} text={analysis ? `${analysis.filled}/3 attendus` : `${record.distance_m.toLocaleString('fr-FR')} m`} />
          : <Cell label="GPS" text="pas de GPS" />}
      </dl>
      {staff?.minutes != null && <p className="text-sm text-ink/70">Temps de jeu : <span className="font-semibold text-ink">{staff.minutes} min</span></p>}
      {staff?.comment && <p className="border-l-2 border-gold pl-3 text-sm italic">« {staff.comment} »</p>}
      <TabLink to="/joueur/performance" className="flex items-center justify-between rounded-lg px-1 py-1 text-sm font-semibold text-gold">
        {own ? 'Voir le détail' : 'Noter mon match'}<ChevronRight size={18} aria-hidden="true" />
      </TabLink>
    </Card>
  )
}

function Cell({ label, color, text }: { label: string; color?: RatingColor | null; text: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 ${color ? 'bg-field' : 'border border-dashed border-line'}`}>
      <dt className="text-xs text-ink/60">{label}</dt>
      <dd className="flex flex-col items-center gap-1">
        {color ? <Coq color={color} className="h-9 w-9" /> : <span aria-hidden="true" className="flex h-9 items-center text-ink/40">—</span>}
        <span className={`text-xs ${color ? 'font-semibold' : 'text-ink/60'}`}>{text}</span>
      </dd>
    </div>
  )
}

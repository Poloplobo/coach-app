import { ChevronRight } from 'lucide-react'
import { TabLink } from '../../components/ui/TabLink'
import { RATING_LABEL, type RatingColor } from './gps'
import { ClubLogo, Coq } from './MatchColor'
import { useMatches, useRatings } from './usePerformance'

// Accueil : son dernier match en une ligne (sa note et celle du coach, visible une fois la sienne donnée, RLS).
// Le commentaire, le temps de jeu et le GPS sont dans l'onglet Performance : toute la ligne y mène.
export function WeekendSummary({ playerId }: { playerId: string }) {
  const matches = useMatches()
  const ratings = useRatings(playerId)
  const match = matches.data?.[0]
  if (!match || !ratings.data) return null
  const own = ratings.data.find(r => r.match_id === match.id && r.rater === 'player')
  // La RLS ne rend la note du coach qu'après celle du joueur ; l'écran ne s'y fie pas seul
  const staff = own ? ratings.data.find(r => r.match_id === match.id && r.rater === 'staff') : undefined

  return (
    <TabLink to="/joueur/performance"
      className="flex min-h-16 items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line/60 transition-transform duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100">
      <ClubLogo match={match} className="h-9 w-9 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-ink/60">Mon dernier match</span>
        <span className="block truncate font-semibold">{match.label ? `${match.label} · ` : ''}{match.opponent}</span>
      </span>
      {own ? (
        <span className="flex shrink-0 items-center gap-3">
          <Note who="moi" color={own.color} />
          <Note who="coach" color={staff?.color} />
        </span>
      ) : <span className="shrink-0 rounded-full bg-gold/15 px-3 py-1.5 text-sm font-semibold text-gold">Noter mon match</span>}
      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink/40" />
    </TabLink>
  )
}

function Note({ who, color }: { who: string; color?: RatingColor | null }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      {color ? <Coq color={color} className="h-7 w-7" /> : <span aria-hidden="true" className="flex h-7 items-center text-ink/40">—</span>}
      <span className="text-[11px] leading-none text-ink/60">{who}<span className="sr-only"> : {color ? RATING_LABEL[color] : 'pas encore noté'}</span></span>
    </span>
  )
}

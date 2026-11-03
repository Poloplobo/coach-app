import type { RatingColor } from './gps'
import type { Match } from './usePerformance'

// Coq de couleur (GPS ou note de match), toujours avec un libellé texte : la couleur seule ne suffit pas à la lecture.
// Une seule silhouette (coq FFR) teintée par masque CSS : les 5 couleurs ont la même forme, un fond transparent, et
// suivent la charte (le gris « pas évaluable » compris). -webkit-mask pour Safari sur iPhone.
// Mêmes couleurs que RATING_HEX (gps.ts), en classes Tailwind
const TINT: Record<RatingColor, string> = { rouge: 'bg-rnr', jaune: 'bg-gold', vert: 'bg-ok', bleu: 'bg-blue', gris: 'bg-muted' }
const MASK = { WebkitMaskImage: 'url(/coq/silhouette.png)', maskImage: 'url(/coq/silhouette.png)', WebkitMaskSize: 'contain', maskSize: 'contain',
  WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' } as const

export function Coq({ color, className = 'h-5 w-5' }: { color: RatingColor; className?: string }) {
  return <span aria-hidden="true" style={MASK} className={`${className} inline-block shrink-0 ${TINT[color]}`} />
}

export function MatchColor({ color, label }: { color: RatingColor | null; label?: string }) {
  if (!color) return <span className="text-ink/50">—</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <Coq color={color} />
      <span>{label ?? color}</span>
    </span>
  )
}

// Logo du club adverse (public/logos-clubs), sinon rien : le nom suffit
export function ClubLogo({ match, className = 'h-7 w-7' }: { match: Pick<Match, 'logo' | 'opponent'>; className?: string }) {
  return match.logo ? <img src={`/logos-clubs/${match.logo}`} alt="" aria-hidden="true" className={`${className} shrink-0 object-contain`} /> : null
}

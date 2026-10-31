import type { RatingColor } from './gps'

// Coq de couleur (GPS ou note de match), toujours avec un libellé texte : la couleur seule ne suffit pas à la lecture.
// Gris (« je n'ai pas joué ») : le coq vert passé en niveaux de gris, estompé.
export function Coq({ color, className = 'h-5 w-5' }: { color: RatingColor; className?: string }) {
  return <img src={`/coq/${color === 'gris' ? 'vert' : color}.png`} alt="" aria-hidden="true"
    className={`${className} shrink-0 object-contain ${color === 'gris' ? 'grayscale opacity-50' : ''}`} />
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

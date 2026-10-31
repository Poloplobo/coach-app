import type { GpsColor } from './gps'

// Pastille de couleur (GPS ou note de match), avec un libellé texte : la couleur seule ne suffit pas à la lecture

const BG: Record<GpsColor, string> = { rouge: 'bg-rnr', jaune: 'bg-gold', vert: 'bg-ok', bleu: 'bg-blue' }

export function MatchColor({ color, label }: { color: GpsColor | null; label?: string }) {
  if (!color) return <span className="text-ink/50">—</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-full ${BG[color]}`} />
      <span>{label ?? color}</span>
    </span>
  )
}

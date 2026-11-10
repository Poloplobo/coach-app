import type { GpsColor } from '../performance/gps'
import type { Reference } from './coqs'

// Coq suivant à aller chercher et l'écart pour l'atteindre (rouge → jaune → vert → bleu ; bleu : rien de plus).
// value et seuils dans l'unité du barème (1RM converti) ; factor : conversion du test vers le barème (testCoq), pour rendre
// l'écart dans l'unité du test passé (ex. kg de 3RM). Le sens compte : pour un temps, il faut descendre sous le seuil.
const NEXT: Record<GpsColor, ['yellow' | 'green' | 'blue', GpsColor] | null> = { rouge: ['yellow', 'jaune'], jaune: ['green', 'vert'], vert: ['blue', 'bleu'], bleu: null }

export function nextCoq(coq: { color: GpsColor; value: number; ref: Pick<Reference, 'blue' | 'green' | 'yellow'> }, higherIsBetter: boolean, factor = 1) {
  const step = NEXT[coq.color]
  if (!step) return null
  const threshold = Number(coq.ref[step[0]])
  const gap = higherIsBetter ? threshold - coq.value : coq.value - threshold
  return { color: step[1], gap: Math.max(0, gap) / factor }
}

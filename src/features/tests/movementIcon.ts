import { Activity, ArrowUpFromLine, Dumbbell, MoveUp, Repeat, Shield, Timer, Weight, Zap, type LucideIcon } from 'lucide-react'

// Pictogramme d'un test ou d'un mouvement, d'après son nom (« Back Squat 1RM », « Sprint 10m »…) ; premier motif trouvé
const ICONS: [RegExp, LucideIcon][] = [
  [/squat|soulev|deadlift|hip thrust/i, Weight],
  [/d[ée]velopp|couch|militaire|bench|push|tirage|rowing/i, Dumbbell],
  [/traction|pull/i, ArrowUpFromLine],
  [/cmj|jump|saut|bond/i, MoveUp],
  [/sprint|fly|vmax|vitesse|\d+\s*m\b/i, Zap],
  [/yo-?yo|navette|vameval|endurance/i, Repeat],
  [/gainage|planche|cervical/i, Shield],
  [/temps|chrono/i, Timer],
]

export const movementIcon = (name: string): LucideIcon => ICONS.find(([re]) => re.test(name))?.[1] ?? Activity

import { bodyZones, fatiguePercent, levelOf, postureOf, type Level, type WellnessRow } from './fatigue'

const FILL: Record<Level, string> = { ok: 'fill-ok', warn: 'fill-gold', bad: 'fill-rnr' }
const WORD: Record<Level, string> = { ok: 'bien', warn: 'moyen', bad: 'à surveiller' }
const LEAN = [0, 10, 20] // degrés : droit, légèrement voûté, voûté

// Silhouette indicative : le haut du corps se voûte avec la fatigue, chaque zone prend la couleur de ses réponses
// figureOnly : la silhouette seule, quand le % est affiché ailleurs (tableau d'affichage de l'accueil)
export function FatigueBody({ wellness, score, compact = false, figureOnly = false }: { wellness: WellnessRow; score: number; compact?: boolean; figureOnly?: boolean }) {
  const pct = fatiguePercent(score)
  const z = bodyZones(wellness)
  const head = levelOf(z.head), body = levelOf(z.body), upper = levelOf(z.upper), lower = levelOf(z.lower)
  const summary = `Fatigue estimée ${pct} % : tête ${WORD[head]}, corps ${WORD[body]}, haut du corps ${WORD[upper]}, bas du corps ${WORD[lower]}`

  const figure = (
      <svg viewBox="0 0 120 220" className={`${compact ? 'h-24 w-14' : 'h-44 w-24'} shrink-0`} role="img" aria-label={summary}>
        {/* jambes : courbatures bas du corps */}
        <rect x="42" y="128" width="15" height="82" rx="7" className={FILL[lower]} />
        <rect x="63" y="128" width="15" height="82" rx="7" className={FILL[lower]} />
        {/* haut du corps, pivote autour des hanches */}
        <g transform={`rotate(${LEAN[postureOf(pct)]} 60 130)`}>
          <rect x="22" y="52" width="13" height="68" rx="6" className={FILL[upper]} />
          <rect x="85" y="52" width="13" height="68" rx="6" className={FILL[upper]} />
          <rect x="38" y="48" width="44" height="84" rx="14" className={FILL[body]} />
          <circle cx="60" cy="26" r="20" className={FILL[head]} />
        </g>
      </svg>
  )
  if (figureOnly) return figure

  return (
    <div className="flex items-center gap-4">
      {figure}
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-display text-2xl font-bold tabular-nums">Fatigue {pct} %</p>
        {!compact && (
          <>
            <p><span className="text-ink/60">Tête</span> {WORD[head]} <span className="text-ink/40">(sommeil, stress, humeur)</span></p>
            <p><span className="text-ink/60">Corps</span> {WORD[body]} <span className="text-ink/40">(fatigue)</span></p>
            <p><span className="text-ink/60">Haut du corps</span> {WORD[upper]} <span className="text-ink/40">(courbatures)</span></p>
            <p><span className="text-ink/60">Bas du corps</span> {WORD[lower]} <span className="text-ink/40">(courbatures)</span></p>
            <p className="text-xs text-ink/40">Représentation indicative, d'après ton état de forme du jour.</p>
          </>
        )}
      </div>
    </div>
  )
}

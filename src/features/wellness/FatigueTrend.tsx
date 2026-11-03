import { addDays } from '../../lib/week'
import { fatiguePercent, postureOf } from './fatigue'
import { useWellnessRange } from './useWellness'

const BAR = ['bg-ok', 'bg-gold', 'bg-rnr'] // fatigue faible, moyenne, à surveiller (comme « Ma semaine »)
const dayLetter = (d: string) => 'DLMMJVS'[new Date(`${d}T12:00:00Z`).getUTCDay()]

// Sa fatigue des 7 derniers jours, en % (jamais le score sur 30, réservé au staff) ; jour sans saisie : case vide
export function FatigueTrend({ playerId, date }: { playerId: string; date: string }) {
  const range = useWellnessRange(playerId, addDays(date, -6), date)
  if (!range.data) return null
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(date, i - 6)
    const score = range.data.find(w => w.entry_date === d)?.score
    return { d, pct: score != null ? fatiguePercent(score) : null }
  })
  if (days.filter(x => x.pct !== null).length < 2) return null // une seule saisie : rien à comparer
  return (
    <section aria-label="Ma fatigue sur 7 jours" className="flex flex-col gap-2 border-t border-line pt-3">
      <h3 className="text-sm text-ink/60">Ma fatigue sur 7 jours</h3>
      <ol className="grid grid-cols-7 gap-1.5">
        {days.map(x => (
          <li key={x.d} className="flex flex-col items-center gap-1" aria-label={`${x.d} : ${x.pct === null ? 'pas de saisie' : `fatigue ${x.pct} %`}`}>
            <span aria-hidden="true" className="text-xs tabular-nums text-ink/60">{x.pct ?? ''}</span>
            <div aria-hidden="true" className="flex h-14 w-full items-end justify-center rounded-md bg-field">
              {x.pct !== null && <div className={`w-1/2 rounded-sm ${BAR[postureOf(x.pct)]}`} style={{ height: `${Math.max(6, x.pct)}%` }} />}
            </div>
            <span aria-hidden="true" className={`font-display text-sm font-semibold ${x.d === date ? 'text-ink' : 'text-ink/50'}`}>{dayLetter(x.d)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

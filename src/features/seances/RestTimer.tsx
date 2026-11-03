import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { restSeconds } from './program'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// Pastille de repos : un appui lance le compte à rebours, un autre l'arrête ; vibre à la fin (Android, pas iPhone).
// Calé sur l'heure de fin : reste juste si l'écran se met en veille. Repos illisible (« récup complète ») : pastille simple.
export function RestTimer({ rest }: { rest: string }) {
  const total = restSeconds(rest)
  const [end, setEnd] = useState<number | null>(null)
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (end === null) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= end) { clearInterval(id); navigator.vibrate?.([200, 100, 200]) }
    }, 250)
    return () => clearInterval(id)
  }, [end])

  if (total === null) {
    return <span className="inline-flex items-center gap-1 rounded-md bg-field px-2 py-0.5 text-ink/80"><Timer size={13} aria-hidden="true" /><span className="sr-only">repos</span>{rest}</span>
  }
  const left = end === null ? null : Math.max(0, Math.ceil((end - now) / 1000))
  const tone = left === null ? 'bg-field text-ink/80' : left > 0 ? 'bg-gold/15 text-gold' : 'bg-ok/15 text-ok'
  return (
    <button type="button" onClick={() => { const t = Date.now(); setNow(t); setEnd(end === null ? t + total * 1000 : null) }}
      aria-label={left === null ? `Lancer le repos de ${rest}` : left > 0 ? `Repos en cours, ${left} secondes : arrêter` : 'Repos terminé : remettre à zéro'}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold tabular-nums transition-colors ${tone}`}>
      <Timer size={13} aria-hidden="true" />
      {left === null ? rest : left > 0 ? clock(left) : 'Go !'}
    </button>
  )
}

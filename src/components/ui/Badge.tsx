import type { ReactNode } from 'react'

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral'
// Étiquette sobre : texte neutre et pastille de couleur ; seul « bad » prend un fond rouge léger. Le rouge reste rare,
// donc lisible comme « grave » (avant : bord et texte colorés partout, l'écran virait au rouge)
const TONES: Record<Tone, string> = { ok: 'bg-ok/10', warn: 'bg-gold/10', bad: 'bg-rnr/15 text-ink', neutral: 'bg-field text-ink/70' }
const DOT: Record<Tone, string | null> = { ok: 'bg-ok', warn: 'bg-gold', bad: 'bg-rnr', neutral: null }

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium tabular-nums text-ink/85 ${TONES[tone]}`}>
      {DOT[tone] && <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[tone]}`} />}{children}
    </span>
  )
}

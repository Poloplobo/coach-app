import type { ReactNode } from 'react'

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral'
const TONES: Record<Tone, string> = {
  ok: 'border-ok text-ok', warn: 'border-gold text-gold', bad: 'border-rnr text-rnr', neutral: 'border-line text-ink/70',
}

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>
}

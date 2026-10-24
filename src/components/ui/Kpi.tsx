export function Kpi({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint?: string; tone?: 'ok' | 'warn' | 'bad' | 'neutral' }) {
  const color = { ok: 'text-ok', warn: 'text-gold', bad: 'text-rnr', neutral: '' }[tone]
  return (
    <div className="border-l-2 border-line pl-3 pr-4 py-1 min-w-40">
      <p className="text-sm text-ink/60">{label}</p>
      <p className={`font-display text-4xl font-semibold leading-none tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink/60">{hint}</p>}
    </div>
  )
}

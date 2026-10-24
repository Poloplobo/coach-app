export function Kpi({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint?: string; tone?: 'ok' | 'warn' | 'bad' | 'neutral' }) {
  const color = { ok: 'text-ok', warn: 'text-gold', bad: 'text-rnr', neutral: '' }[tone]
  return (
    <div className="rounded-2xl bg-surface border border-line px-4 py-3 min-w-44">
      <p className="text-xs text-ink/60">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {hint && <p className="text-xs text-ink/60">{hint}</p>}
    </div>
  )
}

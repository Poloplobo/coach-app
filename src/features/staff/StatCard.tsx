import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'

type Props = {
  label: string; value: number | null; suffix?: string // null : aucune donnée, « — »
  // écart avec la veille ; better : le sens qui est une bonne nouvelle (flèche verte), l'autre est rouge
  delta?: number | null; better?: 'up' | 'down'
  trend?: { day: string; value: number | null }[]; color: string; hint?: string; order?: number
  deltaLabel?: string; decimals?: number // « vs hier » par défaut ; décimales affichées (ex. Vmax 33,9)
}

// Carte de chiffre clé : valeur, écart à la veille, tendance des 7 derniers jours (survol = valeur du jour)
export function StatCard({ label, value, suffix = '', delta, better = 'up', trend, color, hint, order = 0, deltaLabel = 'vs hier', decimals = 0 }: Props) {
  const k = 10 ** decimals
  // Valeur affichée telle quelle : c'est une donnée de travail lue tous les jours, pas une animation à regarder
  const shown = value === null ? '—' : (Math.round(value * k) / k).toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const good = delta != null && delta !== 0 && (delta > 0) === (better === 'up')
  const Arrow = (delta ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight
  const gradient = `spark-${label.replace(/\W/g, '')}`
  return (
    <section className="rise flex flex-col gap-1 rounded-2xl bg-surface p-5 ring-1 ring-line/60" style={{ animationDelay: `${order * 70}ms` }}>
      <p className="text-sm text-ink/60">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="font-display text-4xl font-semibold leading-none tabular-nums">{shown}{value !== null && <span className="text-xl text-ink/60">{suffix}</span>}</p>
        {delta != null && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${delta === 0 ? 'bg-field text-ink/60' : good ? 'bg-ok/15 text-ok' : 'bg-rnr/15 text-rnr'}`}
            title={`Écart ${deltaLabel}`}>
            {delta !== 0 && <Arrow size={14} aria-hidden="true" />}{delta > 0 ? '+' : ''}{delta.toLocaleString('fr-FR')} {deltaLabel}
          </span>
        )}
      </div>
      {trend && trend.some(t => t.value !== null) ? (
        <div className="mt-2 h-12 text-ink" aria-hidden="true">
          <ResponsiveContainer>
            <AreaChart data={trend} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip cursor={{ stroke: 'currentColor', strokeOpacity: 0.2 }} formatter={v => [`${v}${suffix}`, '']} labelFormatter={l => String(l)}
                contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 8, fontSize: 12, padding: '4px 8px' }}
                itemStyle={{ color: 'rgb(var(--ink))', padding: 0 }} labelStyle={{ color: 'rgb(var(--ink) / 0.6)' }} separator="" />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradient})`} connectNulls isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : hint && <p className="mt-2 text-xs text-ink/60">{hint}</p>}
    </section>
  )
}

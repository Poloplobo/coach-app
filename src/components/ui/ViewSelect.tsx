import type { ReactNode } from 'react'

// Choisir ce qu'on regarde (vue, semaine, joueur…) : un menu compact plutôt qu'empiler tous les blocs
export function ViewSelect<T extends string>({ label, value, onChange, children }: {
  label: string; value: T; onChange: (v: T) => void; children: ReactNode
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-ink/60">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value as T)}
        className="rounded-md bg-field border border-line px-2.5 py-1.5 font-semibold text-ink">
        {children}
      </select>
    </label>
  )
}

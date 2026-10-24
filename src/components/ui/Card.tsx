import type { ReactNode } from 'react'

// aside : action ou info rapide à droite du titre (ex. lien « Tout voir », compteur)
export function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg bg-surface border border-line p-4 flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold leading-tight">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  )
}

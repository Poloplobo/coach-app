import type { ReactNode } from 'react'

// Bloc d'un écran. Par défaut ouvert (titre + contenu, sans cadre) : l'écran se lit comme une page, pas comme une pile de boîtes.
// help : une phrase qui dit ce qu'on regarde et comment le lire. aside : action ou info rapide à droite du titre.
// boxed : fond discret, réservé à ce qui doit se détacher (formulaire en cours, bloc principal).
export function Card({ title, help, aside, boxed = false, children }: {
  title: string; help?: ReactNode; aside?: ReactNode; boxed?: boolean; children: ReactNode
}) {
  return (
    <section className={`flex flex-col gap-3 ${boxed ? 'rounded-xl bg-surface p-4' : ''}`}>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-xl font-semibold leading-tight">{title}</h2>
          {help && <p className="max-w-prose text-sm text-ink/60">{help}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  )
}

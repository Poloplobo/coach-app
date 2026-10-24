import type { ReactNode } from 'react'

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface border border-line p-4 flex flex-col gap-3">
      <h2 className="font-bold">{title}</h2>
      {children}
    </section>
  )
}

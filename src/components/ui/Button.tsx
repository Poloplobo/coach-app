import type { ButtonHTMLAttributes } from 'react'

// primary : l'action principale de l'écran (une seule) ; ghost : actions secondaires ; quiet : action discrète dans une ligne
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'quiet' }

const LOOK = {
  primary: 'bg-rnr text-white px-4 py-3 hover:bg-rnr/90',
  ghost: 'border border-line text-ink px-4 py-3 hover:border-ink/40',
  quiet: 'text-ink/70 px-2 py-1.5 text-sm hover:text-ink underline-offset-4 hover:underline',
}

export function Button({ variant = 'primary', className = '', ...props }: Props) {
  return (
    <button {...props}
      className={`rounded-md font-display text-lg font-semibold leading-none tracking-wide transition-colors active:translate-y-px disabled:opacity-40 disabled:active:translate-y-0 ${LOOK[variant]} ${className}`} />
  )
}

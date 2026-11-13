import type { ButtonHTMLAttributes } from 'react'

// primary : l'action principale de l'écran (une seule) ; ghost : actions secondaires ; quiet : action discrète dans une ligne
// size sm : boutons dans une ligne de tableau ou une liste dense (staff)
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'quiet'; size?: 'md' | 'sm' }

const LOOK = {
  // désactivé : gris lisible plutôt qu'un rouge délavé qui a l'air cassé
  primary: 'bg-rnr text-white hover:bg-rnr/90 disabled:bg-line disabled:text-ink/60',
  ghost: 'border border-line text-ink hover:border-ink/40 disabled:opacity-40',
  quiet: 'text-ink/70 hover:text-ink underline-offset-4 hover:underline disabled:opacity-40',
}
const SIZE = { md: 'min-h-10 px-4 py-2.5 text-base', sm: 'px-3 py-1.5 text-sm' } // compacts : un écran doit tenir sans défiler sans fin

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: Props) {
  const box = variant === 'quiet' ? 'px-2 py-1.5 text-sm' : SIZE[size]
  return (
    <button {...props}
      className={`rounded-lg font-display font-semibold leading-none tracking-wide transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:active:scale-100 [@media(pointer:coarse)]:min-h-11 ${box} ${LOOK[variant]} ${className}`} />
  )
}

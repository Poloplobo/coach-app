import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }

export function Button({ variant = 'primary', className = '', ...props }: Props) {
  const look = variant === 'primary' ? 'bg-rnr text-white' : 'border border-line text-ink/80'
  return <button {...props} className={`rounded-lg px-4 py-3 font-semibold disabled:opacity-50 ${look} ${className}`} />
}

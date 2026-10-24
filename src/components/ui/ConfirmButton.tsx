import { useEffect, useState, type ComponentProps } from 'react'
import { Button } from './Button'

// Action lourde ou irréversible : un premier tap arme le bouton, le second confirme (désarmé après 4 s)
export function ConfirmButton({ confirmLabel, onClick, children, ...props }: ComponentProps<typeof Button> & { confirmLabel: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(id)
  }, [armed])
  return (
    <Button {...props} aria-live="polite" onClick={e => { if (armed) { setArmed(false); onClick?.(e) } else setArmed(true) }}>
      {armed ? confirmLabel : children}
    </Button>
  )
}

import { useEffect, useState } from 'react'

// Confirmation visible d'une saisie (2,5 s) + vibration courte quand le téléphone le permet (Android ; iOS l'ignore)
export function useSavedFlash() {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!shown) return
    const id = setTimeout(() => setShown(false), 2500)
    return () => clearTimeout(id)
  }, [shown])
  return [shown, () => { navigator.vibrate?.(15); setShown(true) }] as const
}

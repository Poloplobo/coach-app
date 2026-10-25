import { Check } from 'lucide-react'

// À afficher avec useSavedFlash : le conteneur role="status" reste dans la page pour que l'annonce soit lue
export function SavedFlash({ shown, label = 'Enregistré' }: { shown: boolean; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-1 text-sm font-semibold text-ok">
      {shown && <><Check size={16} aria-hidden="true" />{label}</>}
    </span>
  )
}

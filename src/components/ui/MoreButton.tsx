// « Voir les N autres » / « Réduire » sous une liste coupée : l'essentiel d'abord, le reste à la demande
export function MoreButton({ hidden, open, onToggle }: { hidden: number; open: boolean; onToggle: () => void }) {
  if (!open && hidden <= 0) return null
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="self-start rounded-md px-1 py-1 text-sm font-semibold text-gold hover:underline">
      {open ? 'Réduire' : `Voir ${hidden > 1 ? `les ${hidden} autres` : "l'autre"}`}
    </button>
  )
}

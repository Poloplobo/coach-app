// Boutons pour passer d'une partie d'un onglet staff à l'autre (comme GPS / Match / Test en Performance), au lieu d'une
// liste déroulante : toutes les parties restent visibles, la partie ouverte est remplie en rouge
export function SpaceTabs<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void; options: readonly { id: T; label: string }[]
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-0.5 self-start rounded-lg border border-line p-0.5">
      {options.map(o => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={`min-h-11 rounded-lg px-4 py-1.5 font-display text-lg font-semibold ${value === o.id ? 'bg-rnr text-white' : 'text-ink/70 hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

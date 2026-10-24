// Échelle en boutons (une touche, pas de valeur par défaut qui orienterait la réponse)
type Props = {
  label: string; min: number; max: number; value: number | null; onChange: (v: number) => void
  low: string; high: string; hint?: string
}

export function ScalePicker({ label, min, max, value, onChange, low, high, hint }: Props) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-semibold mb-2">
        {label}{hint && <span className="ml-2 font-normal text-ink/70">{hint}</span>}
      </legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))] gap-1.5">
        {values.map(v => (
          <button
            key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
            className={`h-12 rounded-md font-display text-xl font-semibold border transition-colors ${value === v ? 'bg-rnr border-rnr text-white' : 'bg-app border-line hover:border-ink/40'}`}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-ink/60"><span>{low}</span><span>{high}</span></div>
    </fieldset>
  )
}

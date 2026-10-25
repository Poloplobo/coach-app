// Échelle en boutons (une touche, pas de valeur par défaut qui orienterait la réponse)
type Props = {
  label: string; min: number; max: number; value: number | null; onChange: (v: number) => void
  low: string; high: string; hint?: string
  // couleur propre à chaque valeur (échelle de Borg) : filet sous le bouton, fond quand il est choisi
  color?: (v: number) => { fill: string; text: string }
}

export function ScalePicker({ label, min, max, value, onChange, low, high, hint, color }: Props) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-semibold mb-2">
        {label}{hint && <span className="ml-2 font-normal text-ink/70">{hint}</span>}
      </legend>
      {/* 10 valeurs : deux lignes de 5, plutôt qu'un 6 + 4 bancal */}
      <div role="radiogroup" aria-label={label}
        className={`grid gap-1.5 ${values.length === 10 ? 'grid-cols-5' : 'grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))]'}`}>
        {values.map(v => {
          const c = color?.(v)
          const chosen = value === v
          return (
            <button
              key={v} type="button" role="radio" aria-checked={chosen} onClick={() => onChange(v)}
              style={c && (chosen ? { background: c.fill, borderColor: c.fill, color: c.text } : { borderBottomColor: c.fill })}
              className={`h-12 rounded-md font-display text-xl font-semibold border transition-colors ${
                c ? (chosen ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : 'bg-app border-line border-b-4 hover:border-ink/40')
                  : chosen ? 'bg-rnr border-rnr text-white' : 'bg-app border-line hover:border-ink/40'}`}
            >
              {v}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-ink/60"><span>{low}</span><span>{high}</span></div>
    </fieldset>
  )
}

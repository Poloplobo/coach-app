// Échelle en boutons (une touche, pas de valeur par défaut qui orienterait la réponse)
type Props = {
  label: string; min: number; max: number; value: number | null; onChange: (v: number) => void
  low: string; high: string; hint?: string
  // couleur propre à chaque valeur (échelle de Borg) : filet sous le bouton, fond quand il est choisi
  color?: (v: number) => { fill: string; text: string }
  // inline : question à gauche, boutons à droite sur une ligne (questionnaire court qui doit tenir dans l'écran)
  inline?: boolean
}

export function ScalePicker({ label, min, max, value, onChange, low, high, hint, color, inline = false }: Props) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const buttons = (
    // 10 valeurs : deux lignes de 5, plutôt qu'un 6 + 4 bancal
    <div role="radiogroup" aria-label={label}
      className={`grid gap-1.5 ${values.length === 10 ? 'grid-cols-5' : inline ? 'grid-cols-5' : 'grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))]'}`}>
      {values.map(v => {
        const c = color?.(v)
        const chosen = value === v
        return (
          <button
            key={v} type="button" role="radio" aria-checked={chosen} onClick={() => onChange(v)}
            style={c && (chosen ? { background: c.fill, borderColor: c.fill, color: c.text } : { borderBottomColor: c.fill })}
            className={`${inline ? 'h-10 text-lg' : 'h-11 text-xl'} rounded-md font-display font-semibold border transition-colors ${
              c ? (chosen ? 'ring-2 ring-ink ring-offset-2 ring-offset-app' : 'bg-field border-line border-b-4 hover:border-ink/40')
                : chosen ? 'bg-rnr border-rnr text-white' : 'bg-field border-line hover:border-ink/40'}`}
          >
            {v}
          </button>
        )
      })}
    </div>
  )

  if (inline) {
    return (
      <fieldset className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-center gap-3">
        <legend className="sr-only">{label}</legend>
        <div aria-hidden="true" className="min-w-0">
          <p className="font-semibold leading-tight">{label}</p>
          <p className="text-xs text-ink/55 leading-tight">{min} {low.toLowerCase()} · {max} {high.toLowerCase()}</p>
        </div>
        {buttons}
      </fieldset>
    )
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-semibold mb-2">
        {label}{hint && <span className="ml-2 font-normal text-ink/70">{hint}</span>}
      </legend>
      {buttons}
      <div className="flex justify-between text-xs text-ink/60"><span>{low}</span><span>{high}</span></div>
    </fieldset>
  )
}

import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { RATING_LABEL as COLOR_LABEL, RATING_COLORS, type RatingColor } from './gps'
import { Coq } from './MatchColor'
import { useGuidelines, useSaveGuideline } from './usePerformance'

// Le staff écrit ce que veut dire chaque coq ; le joueur le lit sous le coq au moment de noter son match
export function GuidelinesPanel() {
  const guidelines = useGuidelines()
  if (guidelines.isPending) return <Loading />
  if (guidelines.isError) return <p role="alert">Impossible de charger les consignes.</p>
  return (
    <Card title="Consignes de notation"
      help="Facultatif : une phrase par coq pour aider le joueur à choisir sa couleur après le match. Elle s'affiche sous le coq, pour tous les matchs. Laisse vide pour n'afficher que le libellé.">
      <ul className="flex flex-col gap-4">
        {RATING_COLORS.map(c => <GuidelineRow key={c} color={c} initial={guidelines.data.get(c) ?? ''} />)}
      </ul>
    </Card>
  )
}

function GuidelineRow({ color, initial }: { color: RatingColor; initial: string }) {
  const save = useSaveGuideline()
  const [text, setText] = useState(initial)
  const changed = text.trim() !== initial
  return (
    <li className="flex flex-wrap items-start gap-3">
      <span className="flex w-52 items-center gap-2 pt-2 font-semibold"><Coq color={color} className="h-7 w-7" />{COLOR_LABEL[color]}</span>
      <label className="flex min-w-72 flex-1 flex-col gap-1 text-sm">
        <span className="sr-only">Consigne pour « {COLOR_LABEL[color]} »</span>
        <textarea value={text} maxLength={300} rows={2} onChange={e => setText(e.target.value)}
          placeholder="ex. tu as dominé ton vis-à-vis et pesé sur le match"
          className="rounded-lg bg-field border border-line px-3 py-2 text-base" />
      </label>
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" disabled={!changed || save.isPending} onClick={() => save.mutate({ color, text })}>
          {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        {save.isSuccess && !changed && <span role="status" className="text-sm text-ink/60">Enregistré</span>}
        {save.isError && <span role="alert" className="text-sm text-rnr">Non enregistré</span>}
      </div>
    </li>
  )
}

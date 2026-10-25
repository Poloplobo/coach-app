import { ScalePicker } from '../../components/ui/ScalePicker'
import { RPE_COLORS, RPE_LABELS, rpeInk } from './activities'

// Seul sélecteur de RPE de l'app : échelle de Borg du staff (1 à 10, libellés et couleurs de la feuille)
export function RpePicker({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <ScalePicker label={label} min={1} max={10} low="Très très facile" high="Maximal" value={value} onChange={onChange}
      hint={value !== null ? RPE_LABELS[value] || undefined : undefined}
      color={v => ({ fill: RPE_COLORS[v], text: rpeInk(v) })} />
  )
}

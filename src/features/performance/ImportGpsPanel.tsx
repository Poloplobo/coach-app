import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { parisDate } from '../../lib/week'
import { useGroup, useImportPlayers } from '../staff/programming/useProgramming'
import { MIN_MINUTES, gpsAnalysis, positionGroup } from './gps'
import type { GpsPreview } from './importGps'
import { MatchColor } from './MatchColor'
import { useGpsReference, useImportGps } from './usePerformance'

const field = 'rounded-lg bg-field border border-line px-3 py-2 text-base'

// Après le match : l'export du GPS (8 boîtiers), un aperçu avec la couleur GPS de chaque joueur, puis l'import
export function ImportGpsPanel() {
  const group = useGroup()
  const players = useImportPlayers()
  const reference = useGpsReference()
  const save = useImportGps()
  const [preview, setPreview] = useState<GpsPreview | null>(null)
  const [date, setDate] = useState(parisDate())
  const [opponent, setOpponent] = useState('')
  const [label, setLabel] = useState('')
  const [readError, setReadError] = useState(false)

  if (group.isPending || players.isPending || reference.isPending) return <Loading />
  if (group.isError || players.isError || reference.isError) return <p role="alert">Impossible de préparer l'import GPS.</p>
  const { refs, positions } = reference.data

  const read = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = '' // re-choisir le même fichier corrigé relance la lecture
    if (!file) return
    setReadError(false)
    save.reset()
    try {
      const { readGps } = await import('./importGps') // xlsx chargé seulement ici
      const p = readGps(await file.arrayBuffer(), { players: players.data, positions })
      setPreview(p)
      if (!opponent) setOpponent(p.sheet.replace(/\s*\(\d+\)$/, '')) // onglet « R92 (1) » → « R92 »
    } catch {
      setReadError(true)
    }
  }
  const formErrors = [
    ...(!opponent.trim() ? ['Indique l\'adversaire.'] : []),
    ...(date > parisDate() ? ['La date du match ne peut pas être dans le futur.'] : []),
  ]
  const error = save.error as { message?: string } | null

  return (
    <Card title="Importer les GPS d'un match"
      help={`Export du GPS (POSTE, NOM, KM Total, DHI, Accélération, Vmax, Temps). Chaque joueur est comparé à l'attendu de son poste du match, ramené à 70 min ; sous ${MIN_MINUTES} min jouées, pas de couleur. Réimporter le même match corrige ses lignes.`}>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">Date du match<input type="date" value={date} max={parisDate()} onChange={e => setDate(e.target.value)} className={field} /></label>
        <label className="flex flex-col gap-1 text-sm">Adversaire<input value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="ex. R92" className={field} /></label>
        <label className="flex flex-col gap-1 text-sm">Journée (facultatif)<input value={label} onChange={e => setLabel(e.target.value)} placeholder="ex. J3" className={field} /></label>
        <label className="flex flex-col gap-1 text-sm">Export GPS (.xlsx)
          <input type="file" accept=".xlsx" onChange={e => read(e.target)} className="text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-field file:px-3 file:py-1.5 file:text-ink" />
        </label>
      </div>
      {readError && <p role="alert" className="text-sm text-rnr">Fichier illisible (un .xlsx est attendu) ; recharge la page si le problème continue.</p>}
      {preview && (
        <>
          {preview.errors.length > 0 && <ul role="alert" className="list-disc pl-5 text-sm text-rnr">{preview.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
          {preview.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-ink/60">
                  <tr>{['Joueur', 'Poste du match', 'Min', 'Distance (m)', 'DHI (m)', 'Accél.', 'Vmax', '% distance', '% DHI', '% accél.', 'Couleur GPS'].map(h => <th key={h} className="py-2 pr-3 font-normal">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.rows.map(r => {
                    const a = gpsAnalysis(r, refs.get(positionGroup(r.position, positions) ?? '') ?? null)
                    return (
                      <tr key={r.player.id} className="border-t border-line">
                        <td className="py-2 pr-3 font-semibold">{r.player.last_name} {r.player.first_name}</td>
                        <td className="pr-3">{r.position.toLowerCase()} <span className="text-ink/50">({positionGroup(r.position, positions)})</span></td>
                        <td className="pr-3">{r.minutes}</td>
                        <td className="pr-3">{r.distance_m.toLocaleString('fr-FR')}</td>
                        <td className="pr-3">{r.hi_distance_m}</td>
                        <td className="pr-3">{r.accelerations}</td>
                        <td className="pr-3">{r.vmax ?? '—'}</td>
                        <td className="pr-3">{a ? `${a.pct.distance} %` : '—'}</td>
                        <td className="pr-3">{a ? `${a.pct.hi} %` : '—'}</td>
                        <td className="pr-3">{a ? `${a.pct.accelerations} %` : '—'}</td>
                        <td>{a ? <MatchColor color={a.color} label={`${a.filled}/3`} /> : <span className="text-ink/50">temps de jeu trop court</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {formErrors.length > 0 && <ul className="text-sm text-rnr">{formErrors.map(e => <li key={e}>{e}</li>)}</ul>}
          {save.isSuccess
            ? <p role="status" className="rounded-lg border border-line px-3 py-2 text-sm">{save.data} joueurs importés pour le match du {date} contre {opponent}.</p>
            : (
              <div>
                <Button size="sm" disabled={preview.errors.length > 0 || !preview.rows.length || formErrors.length > 0 || save.isPending}
                  onClick={() => save.mutate({ groupId: group.data.id, date, opponent, label, rows: preview.rows })}>
                  {save.isPending ? 'Import…' : `Importer ${preview.rows.length} joueur${preview.rows.length > 1 ? 's' : ''}`}
                </Button>
              </div>
            )}
          {save.isError && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">Import impossible{error?.message ? ` : ${error.message}` : ''}, réessaie.</p>}
        </>
      )}
    </Card>
  )
}

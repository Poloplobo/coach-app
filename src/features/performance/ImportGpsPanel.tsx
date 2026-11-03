import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { formatDay, parisDate } from '../../lib/week'
import { useGroup, useImportPlayers } from '../staff/programming/useProgramming'
import { MIN_MINUTES, gpsAnalysis, positionGroup } from './gps'
import type { GpsPreview } from './importGps'
import { MatchColor } from './MatchColor'
import { useGpsRecords, useGpsReference, useImportGps, useMatches } from './usePerformance'

const field = 'rounded-lg bg-field border border-line px-3 py-2 text-base'

// Après le match : l'export du GPS (8 boîtiers), un aperçu avec la couleur GPS de chaque joueur, puis l'import.
// Le match vient du calendrier (par défaut le dernier joué) ; « Autre match » garde la saisie libre (amical hors calendrier).
export function ImportGpsPanel() {
  const group = useGroup()
  const players = useImportPlayers()
  const reference = useGpsReference()
  const save = useImportGps()
  const matches = useMatches()
  const gps = useGpsRecords()
  const [matchId, setMatchId] = useState<string | null>(null) // null : dernier match joué ; '' : autre match
  const [preview, setPreview] = useState<GpsPreview | null>(null)
  const [date, setDate] = useState(parisDate())
  const [opponent, setOpponent] = useState('')
  const [label, setLabel] = useState('')
  const [readError, setReadError] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  if (group.isPending || players.isPending || reference.isPending || matches.isPending || gps.isPending) return <Loading />
  if (group.isError || players.isError || reference.isError || matches.isError || gps.isError) return <p role="alert">Impossible de préparer l'import GPS.</p>
  const { refs, positions } = reference.data
  const withGps = new Set(gps.data.map(g => g.match_id))
  const chosen = matchId === '' ? null : matches.data.find(m => m.id === matchId) ?? (matchId === null ? matches.data[0] : undefined) ?? null
  const target = chosen ? { date: chosen.match_date, opponent: chosen.opponent, label: chosen.label ?? '' } : { date, opponent, label }

  // Relu à chaque changement de match : l'onglet Données du classeur contient plusieurs journées
  const read = async (file: File | null, journee: string | null) => {
    if (!file) return
    setFile(file)
    setReadError(false)
    save.reset()
    try {
      const { readGps } = await import('./importGps') // xlsx chargé seulement ici
      const p = readGps(await file.arrayBuffer(), { players: players.data, positions }, journee)
      setPreview(p)
      if (!opponent) setOpponent(p.sheet.replace(/\s*\(\d+\)$/, '')) // autre match : onglet « R92 (1) » → « R92 »
    } catch {
      setReadError(true)
    }
  }
  const formErrors = [
    ...(!target.opponent.trim() ? ['Indique l\'adversaire.'] : []),
    ...(target.date > parisDate() ? ['La date du match ne peut pas être dans le futur.'] : []),
  ]
  const error = save.error as { message?: string } | null

  return (
    <Card title="Importer les GPS d'un match"
      help={`Choisis le match, puis l'export du GPS ou le classeur GPS - MATCH (onglet Données : lignes de la journée du match). Export : POSTE, NOM, KM Total, DHI, Accélération, Vmax, Temps). Chaque joueur est comparé à l'attendu de son poste du match, ramené à 70 min ; sous ${MIN_MINUTES} min jouées, pas de couleur. Réimporter le même match corrige ses lignes.`}>
      <ViewSelect label="Match" value={chosen?.id ?? ''} onChange={v => { setMatchId(v); save.reset(); void read(file, matches.data.find(m => m.id === v)?.label ?? null) }}>
        {matches.data.map(m => <option key={m.id} value={m.id}>{m.label ? `${m.label} · ` : ''}{m.opponent} · {formatDay(m.match_date)}{withGps.has(m.id) ? ' · GPS déjà importé' : ''}</option>)}
        <option value="">Autre match (hors calendrier)…</option>
      </ViewSelect>
      {chosen && withGps.has(chosen.id) && <p className="text-sm text-gold">Ce match a déjà ses GPS : un nouvel import les remplace.</p>}
      <div className="grid gap-3 sm:grid-cols-4">
        {!chosen && (
          <>
            <label className="flex flex-col gap-1 text-sm">Date du match<input type="date" value={date} max={parisDate()} onChange={e => setDate(e.target.value)} className={field} /></label>
            <label className="flex flex-col gap-1 text-sm">Adversaire<input value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="ex. R92" className={field} /></label>
            <label className="flex flex-col gap-1 text-sm">Journée (facultatif)<input value={label} onChange={e => setLabel(e.target.value)} placeholder="ex. J3" className={field} /></label>
          </>
        )}
        <label className="flex flex-col gap-1 text-sm">Export GPS (.xlsx)
          <input type="file" accept=".xlsx" onChange={e => { const f = e.target.files?.[0] ?? null; e.target.value = ''; void read(f, chosen?.label ?? null) }} className="text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-field file:px-3 file:py-1.5 file:text-ink" />
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
            ? <p role="status" className="rounded-lg border border-line px-3 py-2 text-sm">{save.data.rows} joueurs importés pour le match du {formatDay(target.date)} contre {target.opponent}{save.data.removed ? ` · ${save.data.removed} ligne${save.data.removed > 1 ? 's' : ''} retirée${save.data.removed > 1 ? 's' : ''} (absente${save.data.removed > 1 ? 's' : ''} du fichier corrigé)` : ''}.</p>
            : (
              <div>
                <Button size="sm" disabled={preview.errors.length > 0 || !preview.rows.length || formErrors.length > 0 || save.isPending}
                  onClick={() => save.mutate({ groupId: group.data.id, ...target, rows: preview.rows })}>
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

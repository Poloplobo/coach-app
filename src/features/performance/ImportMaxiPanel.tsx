import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { parisDate } from '../../lib/week'
import { useGroup, useImportPlayers, useTestDefinitions } from '../staff/programming/useProgramming'
import type { MaxiRow } from './importMaxi'
import { useImportMaxi } from './usePerformance'

const field = 'rounded-lg bg-field border border-line px-3 py-2 text-base'

// Mise à jour des maxi et objectifs de tout le groupe en un fichier (la saisie joueur par joueur reste dans la fiche joueur)
export function ImportMaxiPanel() {
  const group = useGroup()
  const players = useImportPlayers()
  const tests = useTestDefinitions()
  const save = useImportMaxi()
  const [preview, setPreview] = useState<{ rows: MaxiRow[]; errors: string[] } | null>(null)
  const [date, setDate] = useState(parisDate())
  const [period, setPeriod] = useState('')
  const [readError, setReadError] = useState(false)

  if (group.isPending || players.isPending || tests.isPending) return <Loading />
  if (group.isError || players.isError || tests.isError) return <p role="alert">Impossible de préparer l'import des maxi.</p>

  const read = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    setReadError(false)
    save.reset()
    try {
      const { readMaxi } = await import('./importMaxi') // xlsx chargé seulement ici
      setPreview(readMaxi(await file.arrayBuffer(), { players: players.data, tests: tests.data }))
    } catch {
      setReadError(true)
    }
  }

  return (
    <Card title="Importer les maxi et objectifs"
      help="Un fichier pour tout le groupe : Joueur | Test | Maxi | Objectif | Libellé. Le maxi est enregistré comme résultat de test à la date choisie (l'historique reste) ; l'objectif remplace celui de la saison.">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">Date des maxi<input type="date" value={date} max={parisDate()} onChange={e => setDate(e.target.value)} className={field} /></label>
        <label className="flex flex-col gap-1 text-sm">Période (facultatif)
          <select value={period} onChange={e => setPeriod(e.target.value)} className={field}>
            <option value="">—</option><option>P1</option><option>P2</option><option>P3</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">Fichier (.xlsx)
          <input type="file" accept=".xlsx" onChange={e => read(e.target)} className="text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-field file:px-3 file:py-1.5 file:text-ink" />
        </label>
      </div>
      {readError && <p role="alert" className="text-sm text-rnr">Fichier illisible (un .xlsx est attendu) ; recharge la page si le problème continue.</p>}
      {preview && (
        <>
          {preview.errors.length > 0 && <ul role="alert" className="list-disc pl-5 text-sm text-rnr">{preview.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
          {preview.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-ink/60"><tr>{['Joueur', 'Test', 'Maxi', 'Objectif'].map(h => <th key={h} className="py-2 pr-3 font-normal">{h}</th>)}</tr></thead>
                <tbody>
                  {preview.rows.map(r => (
                    <tr key={`${r.player.id}-${r.test.id}`} className="border-t border-line">
                      <td className="py-2 pr-3 font-semibold">{r.player.last_name} {r.player.first_name}</td>
                      <td className="pr-3">{r.test.name}</td>
                      <td className="pr-3">{r.maxi?.toLocaleString('fr-FR') ?? '—'}</td>
                      <td className="pr-3">{r.target?.toLocaleString('fr-FR') ?? '—'}{r.label ? <span className="text-ink/60"> ({r.label})</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {save.isSuccess
            ? <p role="status" className="rounded-lg border border-line px-3 py-2 text-sm">Importé : {save.data.results} maxi, {save.data.targets} objectifs.</p>
            : (
              <div>
                <Button size="sm" disabled={preview.errors.length > 0 || !preview.rows.length || save.isPending}
                  onClick={() => save.mutate({ date, period, season: group.data.season, rows: preview.rows })}>
                  {save.isPending ? 'Import…' : `Importer ${preview.rows.length} ligne${preview.rows.length > 1 ? 's' : ''}`}
                </Button>
              </div>
            )}
          {save.isError && <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">Import impossible, réessaie.</p>}
        </>
      )}
    </Card>
  )
}

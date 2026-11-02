import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Loading } from '../../../components/ui/Loading'
import { ViewSelect } from '../../../components/ui/ViewSelect'
import { formatDay, parisDate } from '../../../lib/week'
import { weekOf } from '../load'
import type { ProgramPreview } from './importProgram'
import { useExerciseLibrary, useGroup, useImportPlayers, useImportProgram, useTestDefinitions, useWeeksFull, type ImportResult } from './useProgramming'

// Début de cycle : une fiche « Prénom NOM_PER MUSCULATION.xlsx » par joueur, lue dans le navigateur, aperçu puis import
export function ImportPanel() {
  const group = useGroup()
  const weeks = useWeeksFull()
  const players = useImportPlayers()
  const tests = useTestDefinitions()
  const library = useExerciseLibrary()
  const [files, setFiles] = useState<{ key: string; name: string; preview: ProgramPreview }[]>([])
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState(false)
  const [cycleStart, setCycleStart] = useState('')
  const [lastFiles, setLastFiles] = useState<File[]>([])

  if (group.isPending || weeks.isPending || players.isPending || tests.isPending || library.isPending) return <Loading />
  if (group.isError || weeks.isError || players.isError || tests.isError || library.isError) return <p>Impossible de préparer l'import.</p>

  // Semaine 1 du cycle : par défaut celle en cours ; les onglets S1, S2, S4… de la fiche sont datés depuis ce lundi
  const start = cycleStart || (weekOf(weeks.data, parisDate())?.start_date ?? '')
  const read = async (list: File[], firstMonday = start) => {
    if (!list.length) return
    setLastFiles(list)
    setReading(true)
    setReadError(false)
    try {
      const { readProgram } = await import('./importProgram') // xlsx chargé seulement ici
      const ctx = { weeks: weeks.data, players: players.data, tests: tests.data, library: library.data.map(e => e.name), cycleStart: firstMonday }
      const stamp = Date.now()
      const read = await Promise.all(list.map(async f => {
        const key = `${f.name}-${f.lastModified}-${stamp}` // nouvelle lecture = nouvel aperçu, même nom de fichier
        try { return { key, name: f.name, preview: readProgram(await f.arrayBuffer(), ctx, f.name) } }
        catch { return { key, name: f.name, preview: { playerName: null, player: null, sessions: [], targets: [], newExercises: [], past: 0, errors: ['Fichier illisible (un .xlsx est attendu).'] } } }
      }))
      // Deux fiches du même joueur : la dernière importée écraserait l'autre
      const seen = new Map<string, number>()
      for (const f of read) if (f.preview.player) seen.set(f.preview.player.id, (seen.get(f.preview.player.id) ?? 0) + 1)
      setFiles(read.map(f => f.preview.player && seen.get(f.preview.player.id)! > 1
        ? { ...f, preview: { ...f.preview, errors: [...f.preview.errors, 'Plusieurs fiches sélectionnées pour ce joueur : garde-en une seule.'] } }
        : f))
    } catch {
      setReadError(true)
    } finally {
      setReading(false)
    }
  }

  return (
    <Card title="Importer le programme d'un cycle" help="Début de cycle : une fiche par joueur, lue sur cet ordinateur. Aperçu d'abord, rien n'est écrit avant « Importer ».">
      <div className="flex flex-col gap-1 text-sm text-ink/70">
        <p>Fiche « Prénom NOM_PER MUSCULATION.xlsx » :</p>
        <ul className="list-disc pl-5">
          <li>un onglet par semaine du cycle, nommé « CYCLE 2 S1 », « C2S4 »… (S1 = première semaine du cycle, choisie ci-dessous), mêmes colonnes et blocs « Lundi : » que d'habitude ;
            la réhab s'écrit dans ces onglets (blocs R1, R2…) ;</li>
          <li>un onglet OBJECTIFS (facultatif) : Test | Objectif | Libellé (ex. Développé Couché | 100 | 1RM).</li>
        </ul>
        <p>Une séance déjà programmée est remplacée, sauf si le joueur y a répondu. Jours passés et retours du fichier ignorés.
          Ensuite, « Dupliquer une semaine » remplit la suite du cycle.</p>
      </div>
      <ViewSelect label="Semaine 1 du cycle" value={start} onChange={v => { setCycleStart(v); void read(lastFiles, v) }}>
        {weeks.data.map(w => <option key={w.code} value={w.start_date}>{w.code} · {w.label ?? ''} · {formatDay(w.start_date)}</option>)}
      </ViewSelect>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Fiches à importer
        <input type="file" accept=".xlsx" multiple onChange={e => { const list = [...(e.target.files ?? [])]; e.target.value = ''; void read(list) }}
          className="text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-field file:px-3 file:py-1.5 file:text-ink" />
      </label>
      {reading && <Loading />}
      {readError && <p role="alert" className="text-sm text-rnr">Lecture impossible : recharge la page et réessaie.</p>}
      {files.map(f => <FilePreview key={f.key} file={f.name} preview={f.preview} season={group.data.season} />)}
    </Card>
  )
}

function FilePreview({ file, preview: p, season }: { file: string; preview: ProgramPreview; season: string }) {
  const save = useImportProgram()
  const [result, setResult] = useState<ImportResult | null>(null)
  const exercises = p.sessions.reduce((n, s) => n + s.exercises.length, 0)
  const error = save.error as { code?: string; message?: string } | null

  return (
    <section aria-label={file} className="flex flex-col gap-2 border-t border-line pt-3 text-sm">
      <p className="font-semibold">{file}{p.player && <span className="font-normal text-ink/70"> · {p.player.first_name} {p.player.last_name}</span>}</p>
      {p.errors.length > 0
        ? <ul role="alert" className="list-disc pl-5 text-rnr">{p.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        : (
          <>
            <ul className="flex flex-col gap-0.5">
              {p.sessions.map(s => (
                <li key={s.date}>{s.week} · {formatDay(s.date)} : {s.exercises.map(e => `${e.block_label} ${e.name}`).join(', ')}</li>
              ))}
            </ul>
            <p className="text-ink/70">
              {p.sessions.length} séance{p.sessions.length > 1 ? 's' : ''}, {exercises} exercices
              {p.past > 0 && ` · ${p.past} séance${p.past > 1 ? 's' : ''} de jours passés ignorée${p.past > 1 ? 's' : ''} (anciens onglets)`}
              {p.newExercises.length > 0 && ` · nouveaux dans la bibliothèque : ${p.newExercises.join(', ')}`}
              {p.targets.length > 0 && ` · objectifs : ${p.targets.map(t => `${t.test} ${t.value}${t.label ? ` (${t.label})` : ''}`).join(', ')}`}
            </p>
            {result
              ? (
                <p role="status" className="rounded-lg border border-line px-3 py-2">
                  Importé : {result.created} séance{result.created > 1 ? 's' : ''} créée{result.created > 1 ? 's' : ''}, {result.replaced} remplacée{result.replaced > 1 ? 's' : ''}
                  {result.kept > 0 && `, ${result.kept} laissée${result.kept > 1 ? 's' : ''} intacte${result.kept > 1 ? 's' : ''} (déjà renseignée par le joueur)`}
                  {result.past > 0 && `, ${result.past} ignorée${result.past > 1 ? 's' : ''} (jour passé)`}
                  {result.targets > 0 && `, ${result.targets} objectif${result.targets > 1 ? 's' : ''}`}.
                </p>
              )
              : (
                <div>
                  <Button size="sm" aria-label={`Importer la fiche de ${p.player!.first_name} ${p.player!.last_name}`} disabled={save.isPending} onClick={() => save.mutate(
                    { playerId: p.player!.id, season, sessions: p.sessions.map(({ date, exercises }) => ({ date, exercises })), targets: p.targets.map(({ test_id, value, label }) => ({ test_id, value, label })) },
                    { onSuccess: setResult },
                  )}>{save.isPending ? 'Import…' : 'Importer'}</Button>
                </div>
              )}
            {save.isError && (
              <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2">
                {error?.code && /^(P0|42501)/.test(error.code) ? `Import impossible : ${error.message}.` : 'Import impossible, réessaie.'}
              </p>
            )}
          </>
        )}
    </section>
  )
}

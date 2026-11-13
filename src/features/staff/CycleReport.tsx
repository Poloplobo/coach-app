import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { addDays, parisDate } from '../../lib/week'
import { MUSCULATION } from '../rpe/activities'
import { fullName, weekOf } from './load'
import { useExerciseLibrary, useGroup } from './programming/useProgramming'
import { cycleReport } from './report'
import { useLinkTestExercise, usePlayerTargets } from './useReport'
import { useAllLogs, useReference, useRoster, useStaffMuscu } from './useStaff'

// Bilan de cycle d'un joueur en PowerPoint : semaines choisies ici, mouvements prioritaires = ses objectifs chiffrés
export function CycleReport() {
  const ref = useReference()
  const roster = useRoster()
  const group = useGroup()
  const library = useExerciseLibrary()
  const link = useLinkTestExercise()
  const weeks = ref.data?.weeks ?? []
  const current = weekOf(weeks, parisDate())
  // Par défaut : du début du cycle en cours jusqu'à la semaine en cours
  const [playerId, setPlayerId] = useState('')
  const [fromCode, setFromCode] = useState('')
  const [toCode, setToCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const player = roster.data?.find(p => p.id === playerId) ?? roster.data?.[0]
  const to = weeks.find(w => w.code === toCode) ?? current
  const from = weeks.find(w => w.code === fromCode) ?? weeks.find(w => w.cycle && w.cycle === current?.cycle) ?? current
  const range = from && to ? weeks.filter(w => w.start_date >= from.start_date && w.start_date <= to.start_date) : []
  const start = range[0]?.start_date ?? ''
  const end = range.length ? addDays(range.at(-1)!.start_date, 6) : ''
  const sessions = useStaffMuscu(start, end, player?.id)
  const logs = useAllLogs(start, end, player?.id)
  const targets = usePlayerTargets(player?.id ?? '', group.data?.season ?? '')

  const title = 'Bilan de cycle (PowerPoint)'
  if (ref.isError || roster.isError || group.isError) return <Card boxed title={title}><p role="alert" className="text-sm text-rnr">Impossible de préparer le bilan.</p></Card>
  if (!ref.data || !roster.data || !group.data) return <Card boxed title={title}><Loading /></Card>
  if (!player || !current) return <Card boxed title={title}><p className="text-sm text-ink/70">Aucun joueur ou aucune semaine au calendrier.</p></Card>
  const loadError = sessions.isError || logs.isError || targets.isError
  const ready = sessions.data && logs.data && targets.data && range.length > 0

  const download = async () => {
    setBusy(true)
    setFailed(false)
    try {
      const r = cycleReport({
        player, weeks: range, weekTypes: ref.data.weekTypes, sessions: sessions.data!, logs: logs.data!,
        muscuTypeId: ref.data.types.find(t => t.name === MUSCULATION)?.id,
        targets: targets.data!.flatMap(t => t.test_definitions ? [{
          test: t.test_definitions.name, value: Number(t.target_value), label: t.label, exercise: t.test_definitions.exercises?.name ?? null,
        }] : []),
      })
      const { downloadCycleReport } = await import('./exportPptx') // pptxgenjs chargé seulement au clic
      await downloadCycleReport(r, `Bilan_${player.last_name}_${player.first_name}_${range[0].code}-${range.at(-1)!.code}.pptx`)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card boxed title={title}
      help="Un fichier par joueur, prêt à présenter : chiffres clés, objectifs (1RM estimée sur l'exercice lié), courbes, plus gros exercices et charge par semaine.">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <ViewSelect label="Joueur" value={player.id} onChange={setPlayerId}>
          {roster.data.map(p => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
        </ViewSelect>
        <ViewSelect label="De" value={from?.code ?? ''} onChange={setFromCode}>
          {weeks.map(w => <option key={w.code} value={w.code}>{w.code}{w.cycle ? ` · ${w.cycle}` : ''}</option>)}
        </ViewSelect>
        <ViewSelect label="À" value={to?.code ?? ''} onChange={setToCode}>
          {weeks.map(w => <option key={w.code} value={w.code}>{w.code}{w.cycle ? ` · ${w.cycle}` : ''}</option>)}
        </ViewSelect>
        <Button size="sm" disabled={!ready || busy} onClick={download}>{busy ? 'Préparation…' : 'Télécharger le bilan'}</Button>
      </div>
      {range.length === 0 && <p role="alert" className="text-sm text-rnr">La semaine de début doit précéder celle de fin.</p>}
      {loadError && <p role="alert" className="text-sm text-rnr">Impossible de charger les séances de ce joueur.</p>}
      {!ready && !loadError && range.length > 0 && <Loading />}
      {failed && <p role="alert" className="text-sm text-rnr">Création du fichier impossible, réessaie.</p>}
      {targets.data && (
        <div className="text-sm">
          {targets.data.length > 0 && <p className="mb-1 text-ink/60">Exercice suivi pour chaque objectif : le choix s'applique à toute l'équipe.</p>}
          {targets.data.length === 0
            ? <p className="text-ink/70">Aucun objectif chiffré cette saison : le bilan n'aura pas de diapo objectifs (à saisir dans la fiche joueur ou via l'import du cycle).</p>
            : (
              <ul className="flex flex-col gap-1">
                {targets.data.flatMap(t => t.test_definitions ? [t.test_definitions] : []).map(t => (t.unit !== 'kg' || !t.higher_is_better)
                  // Sprint, CMJ… : pas de charge à suivre en salle, l'objectif se lit sur les tests
                  ? <li key={t.id} className="text-ink/60">{t.name} : suivi par les tests (pas de charge en kg)</li>
                  : (
                  <li key={t.id} className="flex flex-wrap items-center gap-2">
                    <span>{t.name} : suivi sur</span>
                    <select aria-label={`Exercice suivi pour ${t.name}`} value={t.exercise_id ?? ''} disabled={link.isPending}
                      onChange={e => link.mutate({ testId: t.id, exerciseId: e.target.value || null })}
                      className="rounded-lg bg-field border border-line px-2 py-1">
                      <option value="">— choisir l'exercice —</option>
                      {(library.data ?? []).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    {!t.exercise_id && <span className="text-ink/60">(sans lien, pas de % gagné)</span>}
                  </li>
                  ))}
              </ul>
            )}
          {link.isError && <p role="alert" className="text-rnr">Lien impossible à enregistrer.</p>}
        </div>
      )}
    </Card>
  )
}

import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { ActivityRow } from './ActivityRow'
import { EXERCISE_SESSIONS, INJURED_EXTRAS, dayActivities, type DayActivity } from './activities'
import { useActivityTypes, useAvailability, useLogsRange, usePlanRange, useSkipsRange } from './useRpe'
import { Loading } from '../../components/ui/Loading'

export function TodayActivities({ playerId, date, title = 'Mes activités du jour' }: { playerId: string; date: string; title?: string }) {
  const availability = useAvailability(playerId)
  const plan = usePlanRange(playerId, date, date)
  const logs = useLogsRange(playerId, date, date)
  const types = useActivityTypes()
  const skips = useSkipsRange(playerId, date, date)
  const [extraIds, setExtraIds] = useState<string[]>([])

  if (availability.isPending || plan.isPending || logs.isPending || types.isPending || skips.isPending) {
    return <Card title={title}><Loading /></Card>
  }
  if (availability.isError || plan.isError || logs.isError || types.isError || skips.isError) {
    return <Card title={title}><p>Impossible de charger tes activités. Vérifie ta connexion.</p></Card>
  }

  const planned = dayActivities(plan.data, { injured: availability.data === 'blessé' })
  const plannedIds = new Set(planned.map(a => a.activityTypeId))
  const toActivity = (t: (typeof types.data)[number]): DayActivity =>
    ({ plannedSessionId: null, activityTypeId: t.id, name: t.name, requiresRpe: t.requires_rpe, durationMin: t.default_duration_min })
  // Activités déclarées hors planning (déjà enregistrées, ou ajoutées à l'instant)
  const extras = types.data
    .filter(t => !plannedIds.has(t.id) && (extraIds.includes(t.id) || logs.data.some(l => l.activity_type_id === t.id)))
    .filter(t => !EXERCISE_SESSIONS.includes(t.name))
    .map(toActivity)
  const shown = new Set([...plannedIds, ...extras.map(a => a.activityTypeId)])
  // Blessé : plus les activités du groupe, il ajoute son cardio et sa reprise terrain ; séances à exercices dans l'onglet Séance
  const injured = availability.data === 'blessé'
  // Blessé : son cardio, sa reprise terrain, et les activités sans RPE (kiné, soins, récupération, vidéo)
  const addable = types.data.filter(t => !shown.has(t.id) && !EXERCISE_SESSIONS.includes(t.name) && (!injured || INJURED_EXTRAS.includes(t.name) || !t.requires_rpe))

  // Compteur en tête : activités déclarées (RPE ou « pas faite ») sur celles affichées
  const all = [...planned, ...extras]
  const answered = all.filter(a => logs.data.some(l => l.activity_type_id === a.activityTypeId) || skips.data.some(k => k.activity_type_id === a.activityTypeId)).length
  return (
    <Card boxed title={title} help="Ton effort ressenti (RPE) et la durée. Vidéo et soins : un simple « J'y étais »."
      aside={all.length > 0 ? <Badge tone={answered === all.length ? 'ok' : 'neutral'}>{answered}/{all.length} déclarée{answered > 1 ? 's' : ''}</Badge> : undefined}>
      {availability.data === 'blessé' && (
        <p className="rounded-xl bg-gold/10 px-3 py-2.5 text-sm ring-1 ring-gold/40">Tu es noté blessé : tes séances de réhab et membres sains sont dans l'onglet Séance. Ici, ajoute ton cardio, ta reprise terrain ou tes soins quand tu en fais.</p>
      )}
      {planned.length === 0 && extras.length === 0 && <p className="text-sm text-ink/70">Aucune activité prévue aujourd'hui.</p>}
      <ul className="flex flex-col divide-y divide-line/60">
        {all.map(a => (
          <ActivityRow key={a.activityTypeId} playerId={playerId} date={date} activity={a}
            log={logs.data.find(l => l.activity_type_id === a.activityTypeId)} skip={skips.data.find(k => k.activity_type_id === a.activityTypeId)}
            onRemove={plannedIds.has(a.activityTypeId) ? undefined : () => setExtraIds(ids => ids.filter(id => id !== a.activityTypeId))} />
        ))}
      </ul>
      {addable.length > 0 && (
        <label className="flex flex-col gap-1 border-t border-line/60 pt-3 text-sm text-ink/70">
          Tu as fait une autre activité ?
          <select value="" onChange={e => setExtraIds(ids => [...ids, e.target.value])} className="rounded-lg bg-field border border-line px-3 py-3 text-base">
            <option value="">Choisir une activité…</option>
            {addable.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      )}
    </Card>
  )
}

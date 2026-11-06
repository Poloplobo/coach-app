import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Kpi } from '../../components/ui/Kpi'
import { Loading } from '../../components/ui/Loading'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { addDays, formatDay, parisDate } from '../../lib/week'
import { EXERCISE_SESSIONS } from '../rpe/activities'
import { fatiguePercent } from '../wellness/fatigue'
import { injurySummary } from './injury'
import { fullName, weekOf, type Log, type Player } from './load'
import { useAllLogs, useAllWellness, useInjuries, useMedicalSessions, useReference, useRoster } from './useStaff'

// Onglet Médical (décision du 06/11/2026) : les joueurs déclarés blessés sortent de la semaine du groupe ; ici, pour chacun,
// le condensé de sa semaine (séances de réhab et membres sains, charge, forme, douleur) et le détail de ses séances.
const DAY = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
const PAIN_TONE = (v: number): 'bad' | 'warn' | 'ok' => (v >= 7 ? 'bad' : v >= 4 ? 'warn' : 'ok')

export function MedicalView() {
  const today = parisDate()
  const ref = useReference()
  const roster = useRoster()
  const injuries = useInjuries()
  const [code, setCode] = useState<string | null>(null)
  const weeks = ref.data?.weeks ?? []
  const week = weeks.find(w => w.code === code) ?? weekOf(weeks, today)
  const from = week?.start_date ?? ''
  const to = week ? addDays(week.start_date, 6) : ''
  const injured = (roster.data ?? []).filter(p => p.injured)
  const ids = injured.map(p => p.id)
  // 4 semaines avant pour l'évolution de la douleur
  const sessions = useMedicalSessions(ids, from ? addDays(from, -21) : '', to)
  const logs = useAllLogs(from, to)
  const wellness = useAllWellness(from, to)

  if (ref.isPending || roster.isPending || injuries.isPending) return <Loading />
  if (ref.isError || roster.isError || injuries.isError) return <p role="alert">Impossible de charger le suivi médical.</p>
  if (!week) return <p>Aucune semaine dans le calendrier.</p>

  return (
    <>
      <ViewSelect label="Semaine" value={week.code} onChange={setCode}>
        {weeks.map(w => <option key={w.code} value={w.code}>{w.code} · {w.label}</option>)}
      </ViewSelect>
      {!injured.length ? (
        <Card title="Aucun joueur blessé">
          <p className="text-sm text-ink/70">Un joueur déclaré blessé (fiche joueur › Gestion, réservé à l'admin) apparaît ici et sort de l'onglet Semaine.</p>
        </Card>
      ) : sessions.isError || logs.isError || wellness.isError ? <p role="alert">Impossible de charger les séances des joueurs blessés.</p>
        : !sessions.data || !logs.data || !wellness.data ? <Loading /> : (
          <div className="flex flex-col gap-6">
            {injured.map(p => (
              <InjuredPlayer key={p.id} player={p} from={from} to={to} today={today} since={injuries.data.find(i => i.player_id === p.id)}
                sessions={sessions.data.filter(s => s.player_id === p.id)} logs={logs.data.filter(l => l.player_id === p.id)}
                wellness={wellness.data.filter(w => w.player_id === p.id)} types={ref.data.types} />
            ))}
          </div>
        )}
    </>
  )
}

type Session = NonNullable<ReturnType<typeof useMedicalSessions>['data']>[number]

function InjuredPlayer({ player, from, to, today, since, sessions, logs, wellness, types }: {
  player: Player; from: string; to: string; today: string; since?: { since: string; note: string | null }
  sessions: Session[]; logs: Log[]; wellness: { entry_date: string; score: number | null; soreness_lower: number | null; soreness_upper: number | null }[]
  types: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState<string | null>(null)
  const last = [to, today].sort()[0]
  const logOf = (s: Session) => logs.find(l => l.session_date === s.session_date && l.activity_type_id === s.activity_type_id)
  const validated = new Set(sessions.filter(s => logOf(s)?.validated_at).map(s => s.id))
  const summary = injurySummary(sessions, validated, from, last)
  const week = sessions.filter(s => s.session_date >= from && s.session_date <= to)
  const load = Math.round(logs.reduce((n, l) => n + Number(l.srpe ?? 0), 0))
  // Activités ajoutées par le joueur (cardio, reprise terrain, soins) : tout ce qui n'est pas une séance à exercices
  const extras = logs.filter(l => !EXERCISE_SESSIONS.includes(types.find(t => t.id === l.activity_type_id)?.name ?? ''))
  const w = [...wellness].sort((a, b) => a.entry_date.localeCompare(b.entry_date)).at(-1)
  const painOf = (s: Session) => {
    const v = s.planned_exercises.map(e => e.exercise_feedback[0]?.pain).filter((x): x is number => x != null)
    return v.length ? Math.round((10 * v.reduce((a, b) => a + b, 0)) / v.length) / 10 : null
  }

  return (
    <Card title={fullName(player)}
      help="Semaine choisie : séances à exercices validées (jusqu'à aujourd'hui), charge déclarée, forme et douleur EVA (0 à 10). Clique sur une séance pour ses exercices."
      aside={<Link to={`/staff/joueur/${player.id}`} className="text-sm text-gold hover:underline">Fiche</Link>}>
      <p className="text-sm text-ink/70">
        <Badge tone="warn">blessé</Badge>{since && <> depuis le {formatDay(since.since)}</>}{since?.note && <> · {since.note}</>}
      </p>
      <div className="flex flex-wrap gap-3">
        <Kpi label="Séances faites" value={`${summary.done} / ${summary.planned}`} tone={summary.planned && summary.done < summary.planned ? 'warn' : 'ok'}
          hint={summary.byType.filter(t => t.planned).map(t => `${t.type} ${t.done}/${t.planned}`).join(' · ') || 'Aucune séance prévue'} />
        <Kpi label="Charge de la semaine" value={`${load} UA`} hint={`${logs.length} déclaration${logs.length > 1 ? 's' : ''}`} />
        <Kpi label="Douleur (dernière)" value={summary.pain.length ? `${Math.max(...summary.pain.map(p => p.last))}/10` : '—'}
          tone={summary.pain.length ? PAIN_TONE(Math.max(...summary.pain.map(p => p.last))) : 'neutral'} hint="Exercice le plus douloureux" />
        <Kpi label="Forme" value={w?.score != null ? `${fatiguePercent(w.score)} % fatigue` : 'non remplie'}
          hint={w ? `${DAY(w.entry_date)} · courbatures bas ${w.soreness_lower ?? '—'}/5, haut ${w.soreness_upper ?? '—'}/5` : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-label="Séances de la semaine" className="flex flex-col">
          <h3 className="font-display text-lg font-semibold">Séances de la semaine</h3>
          {!week.length && <p className="text-sm text-ink/60">Aucune séance à exercices cette semaine.</p>}
          <ul className="flex flex-col">
            {week.map(s => {
              const ex = s.planned_exercises, done = ex.filter(e => e.exercise_feedback[0]?.status === 'fait').length
              const log = logOf(s), pain = painOf(s), expanded = open === s.id
              return (
                <li key={s.id} className="border-t border-line first:border-0">
                  <button type="button" onClick={() => setOpen(expanded ? null : s.id)} aria-expanded={expanded}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-2 text-left text-sm">
                    <span className="w-16 text-ink/60">{DAY(s.session_date)}</span>
                    <span className="font-semibold">{s.activity_types.name}</span>
                    <span className="text-ink/70">{done}/{ex.length} faits</span>
                    {log?.validated_at ? <Badge tone="ok">RPE {Number(log.rpe).toLocaleString('fr-FR')}</Badge>
                      : s.session_date <= last ? <Badge tone="warn">non validée</Badge> : <Badge tone="neutral">à venir</Badge>}
                    {pain !== null && <Badge tone={PAIN_TONE(pain)}>douleur {pain.toLocaleString('fr-FR')}</Badge>}
                    <span aria-hidden="true" className="ml-auto text-ink/50">{expanded ? '▴' : '▾'}</span>
                  </button>
                  {expanded && (
                    <table className="mb-2 w-full text-sm">
                      <thead className="text-left text-xs text-ink/55"><tr><th className="py-1 pr-2 font-normal">Exercice</th><th className="pr-2 font-normal">Prévu</th><th className="pr-2 font-normal">Statut</th><th className="pr-2 font-normal">RPE</th><th className="pr-2 font-normal">Douleur</th><th className="font-normal">Charge</th></tr></thead>
                      <tbody>
                        {[...ex].sort((a, b) => a.position - b.position).map(e => {
                          const f = e.exercise_feedback[0]
                          return (
                            <tr key={e.id} className="border-t border-line/60">
                              <td className="py-1 pr-2"><span className="text-ink/50">{e.block_label} </span>{e.exercises?.name}</td>
                              <td className="pr-2 text-ink/70">{[e.sets, e.reps].filter(Boolean).join(' × ')}</td>
                              <td className="pr-2">{f?.status ?? '—'}</td>
                              <td className="pr-2 tabular-nums">{f?.rpe ?? '—'}</td>
                              <td className="pr-2 tabular-nums">{f?.pain != null ? <Badge tone={PAIN_TONE(f.pain)}>{f.pain}</Badge> : '—'}</td>
                              <td className="text-ink/70">{f?.done_load ?? '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </li>
              )
            })}
          </ul>
          {extras.length > 0 && (
            <p className="mt-2 text-sm text-ink/70">
              <span className="font-semibold text-ink">Ajouté par le joueur : </span>
              {extras.map(l => `${DAY(l.session_date)} ${types.find(t => t.id === l.activity_type_id)?.name ?? '—'} ${l.duration_min} min${l.rpe !== null ? ` RPE ${Number(l.rpe).toLocaleString('fr-FR')}` : ''}`).join(' · ')}
            </p>
          )}
        </section>

        <section aria-label="Douleur par exercice">
          <h3 className="font-display text-lg font-semibold">Douleur par exercice (4 semaines)</h3>
          {!summary.pain.length ? <p className="text-sm text-ink/60">Aucune douleur déclarée pour l'instant.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink/55"><tr><th className="py-1 pr-3 font-normal">Exercice</th><th className="pr-3 font-normal">Dernière</th><th className="pr-3 font-normal">Évolution</th><th className="font-normal">Historique</th></tr></thead>
              <tbody>
                {summary.pain.map(p => (
                  <tr key={p.name} className="border-t border-line">
                    <td className="py-1 pr-3 font-semibold">{p.name}</td>
                    <td className="pr-3"><Badge tone={PAIN_TONE(p.last)}>{p.last}/10</Badge></td>
                    <td className={`pr-3 tabular-nums ${p.trend < 0 ? 'text-ok' : p.trend > 0 ? 'text-rnr' : 'text-ink/60'}`}>{p.trend < 0 ? `↓ ${-p.trend}` : p.trend > 0 ? `↑ ${p.trend}` : '='}</td>
                    <td className="tabular-nums text-ink/70">{p.points.map(x => `${x.date.slice(8, 10)}/${x.date.slice(5, 7)} : ${x.pain}`).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </Card>
  )
}

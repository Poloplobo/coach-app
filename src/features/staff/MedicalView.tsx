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
import { injuryReport, injurySummary } from './injury'
import { fullName, weekOf, type Log, type Player } from './load'
import { useAllLogs, useAllWellness, useInjuries, useInjuryRecords, useInjurySteps, useMedicalSessions, useReference, useRoster } from './useStaff'
import { EpidemiologyCard, ImportPlan, InjuryForm, PlanOverview, ReturnPlan } from './MedicalParts'
import { ImportPanel } from './programming/ImportPanel'
import { useMatches, useRatings } from '../performance/usePerformance'

// Onglet Médical (décision du 06/11/2026) : les joueurs déclarés blessés sortent de la semaine du groupe ; ici, pour chacun,
// le condensé de sa semaine (séances de réhab et membres sains, charge, forme, douleur) et le détail de ses séances.
const DAY = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
const PAIN_TONE = (v: number): 'bad' | 'warn' | 'ok' => (v >= 7 ? 'bad' : v >= 4 ? 'warn' : 'ok')

const VIEWS = [
  { id: 'suivi', label: 'Suivi du joueur blessé' },
  { id: 'plan', label: 'Plan de retour' },
  { id: 'preparation', label: 'Préparer le plan et les séances' },
  { id: 'epidemio', label: 'Épidémiologie' },
] as const
type ViewId = (typeof VIEWS)[number]['id']

export function MedicalView() {
  const today = parisDate()
  const ref = useReference()
  const roster = useRoster()
  const injuries = useInjuries()
  const records = useInjuryRecords()
  const steps = useInjurySteps()
  const [view, setView] = useState<ViewId>('suivi')
  const [chosen, setChosen] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const injured = (roster.data ?? []).filter(p => p.injured)
  const player = injured.find(p => p.id === chosen) ?? injured[0]
  const injury = records.data?.find(i => i.player_id === player?.id && !i.ended_on)
  const since = injuries.data?.find(i => i.player_id === player?.id)
  // Suivi : depuis la survenue (sinon la déclaration « blessé ») ; détail des séances sur la semaine choisie
  const weeks = ref.data?.weeks ?? []
  const week = weeks.find(w => w.code === code) ?? weekOf(weeks, today)
  const start = injury?.occurred_on ?? since?.since ?? addDays(today, -28)
  const weekEnd = week ? addDays(week.start_date, 6) : today
  const from = [start, week?.start_date ?? start].sort()[0]
  const to = [today, weekEnd].sort().at(-1)!
  const sessions = useMedicalSessions(player ? [player.id] : [], from, to)
  const logs = useAllLogs(player ? from : '', to, player?.id)
  const wellness = useAllWellness(player ? addDays(today, -6) : '', today, player?.id)

  if (ref.isPending || roster.isPending || injuries.isPending) return <Loading />
  if (ref.isError || roster.isError || injuries.isError) return <p role="alert">Impossible de charger le suivi médical.</p>
  if (!week) return <p>Aucune semaine dans le calendrier.</p>

  const needsPlayer = view !== 'epidemio'
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <ViewSelect label="Afficher" value={view} onChange={setView}>
          {VIEWS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </ViewSelect>
        {needsPlayer && injured.length > 0 && (
          <ViewSelect label="Joueur" value={player!.id} onChange={setChosen}>
            {injured.map(p => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
          </ViewSelect>
        )}
        {view === 'suivi' && player && (
          <ViewSelect label="Semaine du détail" value={week.code} onChange={setCode}>
            {weeks.map(w => <option key={w.code} value={w.code}>{w.code} · {w.label}</option>)}
          </ViewSelect>
        )}
      </div>
      {view === 'epidemio' ? <Epidemiology today={today} />
        : !player ? (
          <Card title="Aucun joueur blessé">
            <p className="text-sm text-ink/70">Un joueur déclaré blessé (fiche joueur › Gestion, réservé à l'admin) apparaît ici et sort de l'onglet Semaine.</p>
          </Card>
        ) : records.isError || steps.isError ? <p role="alert">Impossible de charger la fiche blessure ou le plan.</p>
        : !records.data || !steps.data ? <Loading />
        : view === 'plan' ? (
          <Card title={`Plan de retour · ${fullName(player)}`} help="Présentation du plan, comme le staff le suit. Le joueur voit le sien sur son Accueil : phases, étapes, objectifs et actions prépa, jamais les actions kiné ni les commentaires.">
            {injury ? <PlanOverview injury={injury} steps={steps.data.filter(s => s.injury_id === injury.id)} today={today} />
              : <p className="text-sm text-ink/60">Pas de fiche blessure ouverte pour ce joueur.</p>}
          </Card>
        ) : view === 'preparation' ? (
          <div className="flex flex-col gap-6">
            {injury ? <>
              <Card title="Importer un plan (Excel)" help="Même format que le plan de réhabilitation : Étape | Objectifs | Actions Kiné | Actions Prépa | Statut | Commentaires, avec les lignes « Phase N : … - 14 JOURS ». Aperçu avant de remplacer le plan.">
                <ImportPlan injury={injury} current={steps.data.filter(s => s.injury_id === injury.id).length} today={today} />
              </Card>
              <Card title="Créer ou modifier le plan" help="Chaque étape : titre, critères, durée, et ses détails (phase, objectifs, actions). Valide une étape quand ses critères sont atteints.">
                <ReturnPlan injury={injury} steps={steps.data.filter(s => s.injury_id === injury.id)} today={today} />
              </Card>
            </> : <p className="text-sm text-ink/60">Pas de fiche blessure ouverte pour ce joueur.</p>}
            {/* Séances de réhab et membres sains : mêmes fiches que Programmation (« Lundi RÉHAB : », « Lundi MEMBRES SAINS : ») */}
            <ImportPanel />
            {injury && <InjuryForm injury={injury} />}
          </div>
        ) : sessions.isError || logs.isError || wellness.isError ? <p role="alert">Impossible de charger les séances du joueur.</p>
        : !sessions.data || !logs.data || !wellness.data ? <Loading />
        : <InjuredPlayer player={player} from={week.start_date} to={weekEnd} start={start} today={today} since={since}
            sessions={sessions.data} logs={logs.data} wellness={wellness.data} types={ref.data.types} />}
    </>
  )
}

// Épidémiologie : saison entière ou un cycle ; exposition = minutes déclarées + minutes de match saisies par le coach
function Epidemiology({ today }: { today: string }) {
  const ref = useReference()
  const roster = useRoster()
  const records = useInjuryRecords()
  const [period, setPeriod] = useState('saison')
  const weeks = ref.data?.weeks ?? []
  const cycles = [...new Set(weeks.map(w => w.cycle).filter((c): c is string => !!c))]
  const inPeriod = period === 'saison' ? weeks : weeks.filter(w => w.cycle === period)
  const pFrom = inPeriod[0]?.start_date ?? ''
  const pTo = [inPeriod.length ? addDays(inPeriod.at(-1)!.start_date, 6) : today, today].sort()[0]
  const periodLogs = useAllLogs(pFrom, pTo)
  const matches = useMatches()
  const ratings = useRatings()
  if (records.isError || periodLogs.isError || matches.isError || ratings.isError || ref.isError || roster.isError) return <p role="alert">Impossible de charger l'épidémiologie.</p>
  if (!records.data || !periodLogs.data || !matches.data || !ratings.data || !ref.data || !roster.data || !pFrom) return <Loading />
  const matchMin = ratings.data.filter(r => r.rater === 'staff' && r.minutes)
    .filter(r => { const d = matches.data.find(m => m.id === r.match_id)?.match_date; return !!d && d >= pFrom && d <= pTo })
    .reduce((n, r) => n + (r.minutes ?? 0), 0)
  return (
    <>
      <ViewSelect label="Période" value={period} onChange={setPeriod}>
        <option value="saison">Saison</option>
        {cycles.map(c => <option key={c} value={c}>{c}</option>)}
      </ViewSelect>
      {/* Exposition au risque : activités d'entraînement avec RPE (vidéo, soins, récupération exclues) hors réhab et membres sains */}
      <EpidemiologyCard injuries={records.data.filter(i => roster.data.some(p => p.id === i.player_id))} players={roster.data} from={pFrom} to={pTo} today={today} period={period}
        exposure={{ trainingMin: periodLogs.data.filter(l => { const t = ref.data.types.find(x => x.id === l.activity_type_id)
          return t?.requires_rpe && t.name !== 'Réhabilitation' && t.name !== 'Membres sains' }).reduce((n, l) => n + l.duration_min, 0), matchMin }} />
    </>
  )
}

type Session = NonNullable<ReturnType<typeof useMedicalSessions>['data']>[number]

function InjuredPlayer({ player, from, to, start, today, since, sessions: all, logs: allLogs, wellness, types }: {
  player: Player; from: string; to: string; start: string; today: string; since?: { since: string; note: string | null }
  sessions: Session[]; logs: Log[]; wellness: { entry_date: string; score: number | null; soreness_lower: number | null; soreness_upper: number | null }[]
  types: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState<string | null>(null)
  const last = [to, today].sort()[0]
  const report = injuryReport(all, allLogs, types, start, today)
  // Détail : la semaine choisie ; douleur par exercice : 4 semaines avant sa fin
  const sessions = all.filter(s => s.session_date >= addDays(from, -21) && s.session_date <= to)
  const logs = allLogs.filter(l => l.session_date >= from && l.session_date <= to)
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
      help="Rapport depuis la blessure, semaine par semaine. Puis, pour la semaine choisie : séances à exercices validées (jusqu'à aujourd'hui), charge déclarée, forme et douleur EVA (0 à 10). Clique sur une séance pour ses exercices."
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

      <ReportTable weeks={report.weeks} since={start} />

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

// Rapport de suivi depuis la blessure : une ligne par semaine (la plus récente en haut)
function ReportTable({ weeks, since }: { weeks: ReturnType<typeof injuryReport>['weeks']; since: string }) {
  const ratio = (x: { done: number; planned: number }) => (x.planned ? `${x.done}/${x.planned}` : '—')
  const extra = (x: { n: number; min: number }) => (x.n ? `${x.n} · ${x.min} min` : '—')
  return (
    <section aria-label="Rapport depuis la blessure" className="flex flex-col gap-1">
      <h3 className="font-display text-lg font-semibold">Depuis la blessure ({formatDay(since)})</h3>
      {!weeks.length ? <p className="text-sm text-ink/60">Rien de déclaré depuis la blessure.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink/55">
              <tr><th className="py-1 pr-3 font-normal">Semaine du</th><th className="pr-3 font-normal">Réhab</th><th className="pr-3 font-normal">Membres sains</th>
                <th className="pr-3 font-normal">Cardio</th><th className="pr-3 font-normal">Reprise terrain</th><th className="pr-3 font-normal">RPE moyen</th><th className="font-normal">Douleur moyenne</th></tr>
            </thead>
            <tbody>
              {[...weeks].reverse().map(w => (
                <tr key={w.monday} className="border-t border-line">
                  <td className="py-1 pr-3 font-semibold">{DAY(w.monday)}</td>
                  <td className="pr-3 tabular-nums">{ratio(w.rehab)}</td>
                  <td className="pr-3 tabular-nums">{ratio(w.healthy)}</td>
                  <td className="pr-3 tabular-nums">{extra(w.cardio)}</td>
                  <td className="pr-3 tabular-nums">{extra(w.field)}</td>
                  <td className="pr-3 tabular-nums">{w.rpe?.toLocaleString('fr-FR') ?? '—'}</td>
                  <td className="tabular-nums">{w.pain != null ? <Badge tone={PAIN_TONE(w.pain)}>{w.pain.toLocaleString('fr-FR')}/10</Badge> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

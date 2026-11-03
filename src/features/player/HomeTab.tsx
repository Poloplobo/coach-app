import { Card } from '../../components/ui/Card'
import { addDays, isoWeekStart } from '../../lib/week'
import { Check, ChevronRight } from 'lucide-react'
import { TabLink } from '../../components/ui/TabLink'
import { MUSCULATION, dayActivities, upcomingByDay } from '../rpe/activities'
import { useAvailability, useCatchUpDay, usePlanRange } from '../rpe/useRpe'
import { completion } from '../seances/program'
import { useWeekProgram } from '../seances/useSeance'
import { MyGoals } from '../tests/MyGoals'
import { FatigueBody } from '../wellness/FatigueBody'
import { fatiguePercent } from '../wellness/fatigue'
import { useWellnessDay } from '../wellness/useWellness'
import { useLogsRange } from '../rpe/useRpe'
import { MyWeek } from './MyWeek'
import { usePlayerDay } from './playerDay'
import { Loading } from '../../components/ui/Loading'

const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })

// Accueil : résumé de la semaine (fatigue, charge, musculation, à venir, objectifs)
export function HomeTab() {
  const { playerId, today } = usePlayerDay()
  // Les blocs apparaissent l'un après l'autre (une fois ; coupé si l'appareil demande moins d'animations)
  const rise = (i: number) => ({ className: 'rise empty:hidden', style: { animationDelay: `${i * 70}ms` } })
  return (
    <>
      <div {...rise(0)}><CatchUp playerId={playerId} today={today} /></div>
      <div {...rise(0)}><Scoreboard playerId={playerId} today={today} /></div>
      <div {...rise(1)}><TodoToday playerId={playerId} today={today} /></div>
      <div {...rise(2)}><MyWeek playerId={playerId} date={today} footer={<MuscuWeek playerId={playerId} today={today} />} /></div>
      <div {...rise(3)}><Upcoming playerId={playerId} today={today} /></div>
      <div {...rise(4)}><MyGoals playerId={playerId} date={today} /></div>
    </>
  )
}

// Relance du staff : ce qu'il reste à déclarer d'hier, en tête de l'accueil ; tout est déclaré ou pas de relance : rien
function CatchUp({ playerId, today }: { playerId: string; today: string }) {
  const day = useCatchUpDay(playerId, today).data
  return day ? <TodoToday playerId={playerId} today={day} title="Le staff attend ta saisie d'hier" /> : null
}

// Ce qu'il reste à déclarer aujourd'hui, avec un raccourci vers le bon onglet ; rien de prévu : pas de bloc
function TodoToday({ playerId, today, title }: { playerId: string; today: string; title?: string }) {
  const plan = usePlanRange(playerId, today, today)
  const logs = useLogsRange(playerId, today, today)
  const availability = useAvailability(playerId)
  if (!plan.data || !logs.data || !availability.data) return null
  const acts = dayActivities(plan.data, { injured: availability.data === 'blessé', includeMuscu: true })
  if (!acts.length) return null
  const isMuscu = (a: (typeof acts)[number]) => a.name === MUSCULATION
  // la musculation compte quand la séance est validée ; les autres activités dès qu'elles sont déclarées
  const pending = acts.filter(a => {
    const l = logs.data.find(x => x.activity_type_id === a.activityTypeId)
    return isMuscu(a) ? !l?.validated_at : !l
  })
  if (!pending.length) return title ? null : <p className="flex items-center gap-2 rounded-xl bg-ok/10 px-4 py-3 font-semibold text-ok"><Check size={18} aria-hidden="true" />Tout est déclaré pour aujourd'hui.</p>
  return (
    <section aria-label={title ?? 'À faire aujourd\'hui'} className={`flex flex-col gap-2 rounded-xl bg-surface p-4 ring-1 ${title ? 'ring-2 ring-gold' : 'ring-line/60'}`}>
      <h2 className="font-display text-xl font-semibold leading-tight">{title ?? 'À faire aujourd\'hui'}</h2>
      <ul className="flex flex-col gap-2">
        {pending.map(a => (
          <li key={a.activityTypeId}>
            <TabLink to={isMuscu(a) ? '/joueur/seance' : '/joueur/rugby'}
              className="flex items-center justify-between gap-3 rounded-lg bg-field px-3 py-2.5 active:bg-ink/10">
              <span><span className="font-semibold">{a.name}</span>{' '}
                <span className="text-sm text-ink/60">{isMuscu(a) ? 'séance à remplir' : a.requiresRpe ? 'effort à déclarer' : 'présence à confirmer'}</span></span>
              <ChevronRight size={18} aria-hidden="true" className="text-ink/50" />
            </TabLink>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Le tableau d'affichage : fatigue du jour et charge de la semaine, lisibles d'un coup d'œil
function Scoreboard({ playerId, today }: { playerId: string; today: string }) {
  const wellness = useWellnessDay(playerId, today)
  const week = isoWeekStart(today)
  const logs = useLogsRange(playerId, [week, addDays(today, -6)].sort()[0], today) // même requête que « Ma semaine » : servie par le cache
  const w = wellness.data
  const load = logs.data?.filter(l => l.session_date >= week).reduce((sum, l) => sum + Number(l.srpe ?? 0), 0)

  return (
    <section aria-label="Mon tableau du jour" className="flex items-center gap-4 rounded-lg border border-line bg-surface px-4 py-3">
      {w && w.score !== null && <FatigueBody wellness={w} score={w.score} figureOnly />}
      <dl className="grid flex-1 grid-cols-2 divide-x divide-line">
        <div className="pr-3 flex flex-col-reverse">
          <dt className="mt-1 text-sm text-ink/60">Fatigue du jour</dt>
          <dd className="font-display text-[clamp(2.4rem,12vw,3.75rem)] font-bold leading-none tabular-nums">{w?.score != null ? fatiguePercent(w.score) : '–'}<span className="text-2xl">%</span></dd>
        </div>
        <div className="pl-3 flex flex-col-reverse">
          <dt className="mt-1 text-sm text-ink/60">UA cette semaine</dt>
          <dd className="font-display text-[clamp(2.4rem,12vw,3.75rem)] font-bold leading-none tabular-nums">{load ?? '–'}</dd>
        </div>
      </dl>
    </section>
  )
}

function MuscuWeek({ playerId, today }: { playerId: string; today: string }) {
  const from = isoWeekStart(today)
  const program = useWeekProgram(playerId, from, addDays(from, 6))
  if (!program.data?.length) return null
  const done = program.data.filter(s => s.session_date <= today).flatMap(s => s.planned_exercises)
  const c = completion(done)
  const left = program.data.filter(s => s.session_date > today).length
  return (
    <p className="text-sm">
      <span className="font-semibold">Musculation</span> <span className="text-ink/70">
        {c.done}/{c.total} exercices faits ({c.pct} %){left > 0 && ` · ${left} séance${left > 1 ? 's' : ''} encore prévue${left > 1 ? 's' : ''}`}
      </span>
    </p>
  )
}

function Upcoming({ playerId, today }: { playerId: string; today: string }) {
  const plan = usePlanRange(playerId, today, addDays(today, 6))
  const availability = useAvailability(playerId)
  if (plan.isPending || availability.isPending) return <Card title="À venir"><Loading /></Card>
  if (plan.isError || availability.isError) return <Card title="À venir"><p>Impossible de charger ton planning.</p></Card>

  // les 3 prochains jours avec activité : la suite se voit le moment venu, l'accueil reste court
  const days = upcomingByDay(plan.data, { injured: availability.data === 'blessé' }).slice(0, 3)
  return (
    <Card title="À venir">
      {days.length === 0 && <p className="text-sm text-ink/70">Rien de prévu sur les 7 prochains jours.</p>}
      <ul className="flex flex-col gap-2 text-sm">
        {days.map(d => (
          <li key={d.date} className="grid grid-cols-[5.5rem_1fr] gap-2">
            <span className="font-display font-semibold first-letter:uppercase">{d.date === today ? "Aujourd'hui" : shortDay(d.date)}</span>
            <span className="text-ink/75">{d.activities.map(a => a.durationMin ? `${a.name} ${a.durationMin}'` : a.name).join(' · ')}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

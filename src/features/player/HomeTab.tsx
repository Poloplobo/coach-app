import { addDays, isoWeekStart } from '../../lib/week'
import { Check, ChevronRight } from 'lucide-react'
import { TabLink } from '../../components/ui/TabLink'
import { EXERCISE_SESSIONS, dayActivities, upcomingByDay } from '../rpe/activities'
import { useAvailability, useCatchUpDay, usePlanRange, useWeekTarget } from '../rpe/useRpe'
import { completion } from '../seances/program'
import { useWeekProgram } from '../seances/useSeance'
import { SeasonProfileCard } from '../tests/SeasonProfileCard'
import { WeekendSummary } from '../performance/WeekendSummary'
import { FatigueBody } from '../wellness/FatigueBody'
import { fatiguePercent } from '../wellness/fatigue'
import { useWellnessDay } from '../wellness/useWellness'
import { useLogsRange } from '../rpe/useRpe'
import { MyWeek } from './MyWeek'
import { ReturnPlanCard } from './ReturnPlanCard'
import { usePlayerDay } from './playerDay'
import { Loading } from '../../components/ui/Loading'

const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })

// Accueil, du plus urgent au plus calme : ce qu'il reste à faire, le plan de retour (blessé), le tableau du jour (fatigue,
// charge), la semaine (avec la muscu et les jours à venir), le dernier match, le profil de saison. Maxi et objectifs : onglet Perf.
export function HomeTab() {
  const { playerId, today } = usePlayerDay()
  // Les blocs apparaissent l'un après l'autre (une fois ; coupé si l'appareil demande moins d'animations)
  const rise = (i: number) => ({ className: 'rise empty:hidden', style: { animationDelay: `${i * 70}ms` } })
  return (
    <>
      <div {...rise(0)}><CatchUp playerId={playerId} today={today} /></div>
      <div {...rise(0)}><TodoToday playerId={playerId} today={today} /></div>
      <div {...rise(1)}><ReturnPlanCard today={today} /></div>
      <div {...rise(2)}><Scoreboard playerId={playerId} today={today} /></div>
      <div {...rise(3)}><MyWeek playerId={playerId} date={today} footer={<><MuscuWeek playerId={playerId} today={today} /><Upcoming playerId={playerId} today={today} /></>} /></div>
      <div {...rise(4)}><WeekendSummary playerId={playerId} /></div>
      <div {...rise(5)}><SeasonProfileCard playerId={playerId} date={today} /></div>
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
  const isMuscu = (a: (typeof acts)[number]) => EXERCISE_SESSIONS.includes(a.name)
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

// Le tableau d'affichage : fatigue du jour et charge de la semaine, lisibles d'un coup d'œil, puis la charge dans sa plage
function Scoreboard({ playerId, today }: { playerId: string; today: string }) {
  const wellness = useWellnessDay(playerId, today)
  const week = isoWeekStart(today)
  const logs = useLogsRange(playerId, [week, addDays(today, -6)].sort()[0], today) // même requête que « Ma semaine » : servie par le cache
  const target = useWeekTarget(week).data
  const w = wellness.data
  const load = logs.data?.filter(l => l.session_date >= week).reduce((sum, l) => sum + Number(l.srpe ?? 0), 0)

  return (
    <section aria-label="Mon tableau du jour" className="flex flex-col gap-3 rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex items-center gap-4">
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
      </div>
      {target && load !== undefined && <WeekGauge load={load} target={target} daysLeft={6 - Math.round((Date.parse(today) - Date.parse(week)) / 864e5)} />}
    </section>
  )
}

// Charge de la semaine face à la plage de son type (REG 500-1500, COMP 1500-2500, DEV au-delà de 2500) : bande verte = plage
function WeekGauge({ load, target, daysLeft }: {
  load: number; daysLeft: number; target: { week: string; code: string; name: string; srpe_min: number | null; srpe_max: number | null }
}) {
  const min = target.srpe_min ?? 0
  const top = Math.max(target.srpe_max ?? min * 1.4, load) * 1.15
  const end = target.srpe_max ?? top
  const where = load < min ? 'below' : target.srpe_max !== null && load > target.srpe_max ? 'above' : 'in'
  const pos = (v: number) => `${(100 * v) / top}%`
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3">
      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span><span className="font-semibold">{target.week} · {target.name}</span> <span className="text-ink/60">plage {min.toLocaleString('fr-FR')}{target.srpe_max !== null ? `–${target.srpe_max.toLocaleString('fr-FR')}` : ' et +'} UA</span></span>
        <span className={`shrink-0 font-semibold ${where === 'in' ? 'text-ok' : where === 'above' ? 'text-rnr' : 'text-ink/60'}`}>
          {where === 'in' ? 'dans la plage' : where === 'above' ? 'au-dessus' : daysLeft > 0 ? `encore ${daysLeft} j` : 'sous la plage'}
        </span>
      </p>
      <div className="relative h-2.5 rounded-full bg-field" aria-hidden="true">
        <span className="absolute inset-y-0 rounded-full bg-ok/25" style={{ left: pos(min), width: pos(end - min) }} />
        <span className={`absolute inset-y-0 left-0 rounded-full ${where === 'in' ? 'bg-ok' : where === 'above' ? 'bg-rnr' : 'bg-ink/60'}`} style={{ width: pos(Math.max(load, top * 0.02)) }} />
      </div>
    </div>
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
      <span className="font-semibold">{program.data.every(s => s.activity_types.name === 'Musculation') ? 'Musculation' : 'Réhab et membres sains'}</span> <span className="text-ink/70">
        {c.done}/{c.total} exercices faits ({c.pct} %){left > 0 && ` · ${left} séance${left > 1 ? 's' : ''} encore prévue${left > 1 ? 's' : ''}`}
      </span>
    </p>
  )
}

// Les 3 prochains jours avec activité (à partir de demain), en pied de « Ma semaine » : la suite se voit le moment venu
function Upcoming({ playerId, today }: { playerId: string; today: string }) {
  const plan = usePlanRange(playerId, addDays(today, 1), addDays(today, 7)) // aujourd'hui : « À faire » et « Ma semaine »
  const availability = useAvailability(playerId)
  if (plan.isPending || availability.isPending) return <Loading />
  if (plan.isError || availability.isError) return <p className="text-sm">Impossible de charger ton planning.</p>
  const days = upcomingByDay(plan.data, { injured: availability.data === 'blessé' }).slice(0, 3)
  return (
    <div className="flex flex-col gap-1.5 border-t border-line/60 pt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">À venir</h3>
      {days.length === 0 && <p className="text-sm text-ink/70">Rien de prévu sur les 7 prochains jours.</p>}
      <ul className="flex flex-col gap-1.5 text-sm">
        {days.map(d => (
          <li key={d.date} className="grid grid-cols-[4.5rem_1fr] gap-2">
            <span className="font-display font-semibold first-letter:uppercase">{d.date === addDays(today, 1) ? 'Demain' : shortDay(d.date)}</span>
            <span className="text-ink/75">{d.activities.map(a => a.durationMin ? `${a.name} ${a.durationMin}'` : a.name).join(' · ')}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

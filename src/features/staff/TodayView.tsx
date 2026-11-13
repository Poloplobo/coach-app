import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellOff, BellRing, Check, ChevronDown, Copy } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { MoreButton } from '../../components/ui/MoreButton'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { BRAND } from '../../lib/brand'
import { addDays, formatDay, isoWeekStart } from '../../lib/week'
import { useParisToday } from '../../lib/useParisToday'
import { useProfile, useUserId } from '../auth/useAuth'
import { StatCard } from './StatCard'
import { fatiguePercent, postureOf } from '../wellness/fatigue'
import { WELLNESS_ITEMS } from '../wellness/items'
import { WELLNESS_ALERT_SCORE, fullName, itemValue, latecomers, missingRpe, overLoad, reminderMessage, rpeGap, rpeVsTarget, sessionTarget, weekOf, weekPace, wellnessAlerts, type Heat, type Player } from './load'
import { SKIP_REASONS, type SkipReason } from '../rpe/activities'
import { Avatar } from '../photos/PlayerPhoto'
import { useAllLogs, useAllPlan, useAllSkips, useAllWellness, usePushEnabled, useReference, useRemind, useReminders, useRoster, useTargetRpes } from './useStaff'

// Seules les réponses moyennes ou mauvaises ressortent ; le rouge est gardé pour le 1 (déclencheur d'alerte)
const itemLook = (v: number) => (v >= 4 ? 'text-ink/45' : v === 3 ? 'text-ink/85' : v === 2 ? 'text-gold font-semibold' : 'text-rnr font-bold')
const BAR = ['bg-ok', 'bg-gold', 'bg-rnr'] // fatigue faible, moyenne, à surveiller
const SHORT: Record<string, string> = { soreness_upper: 'Courb. haut', soreness_lower: 'Courb. bas' }
type Filter = 'tous' | 'alertes' | 'non-remplis' | 'bien' | 'moyen' | 'surveiller'
// Forme du groupe : même découpage que la jauge de fatigue (postureOf) ; un clic sur une part filtre le tableau
const LEVELS = [
  { id: 'bien', label: 'En forme', color: BRAND.ok },
  { id: 'moyen', label: 'Fatigue moyenne', color: BRAND.gold },
  { id: 'surveiller', label: 'À surveiller', color: BRAND.rnr },
] as const
const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })

export function TodayView() {
  const today = useParisToday() // écran resté ouvert après minuit : « hier » suit
  const yesterday = addDays(today, -1)
  const roster = useRoster()
  const me = useProfile(useUserId())
  const wellness = useAllWellness(addDays(today, -6), today) // 7 jours : tendances des cartes
  const logs = useAllLogs(yesterday, today)
  const plan = useAllPlan(yesterday, yesterday)
  const reminded = useReminders(yesterday)
  const push = usePushEnabled()
  // Charge de la semaine en cours : seuils par activité et rythme selon le planning (0030)
  const monday = isoWeekStart(today)
  const ref = useReference()
  const weekLogs = useAllLogs(monday, today)
  const weekPlan = useAllPlan(monday, addDays(monday, 6))
  const targets = useTargetRpes()
  // RPE non déclarés sur les 7 derniers jours (aujourd'hui exclu : la journée n'est pas finie)
  const recentLogs = useAllLogs(addDays(today, -7), yesterday)
  const recentPlan = useAllPlan(addDays(today, -7), yesterday)
  const recentSkips = useAllSkips(addDays(today, -7), yesterday)
  const [filter, setFilter] = useState<Filter>('tous')
  const [allLate, setAllLate] = useState(false)

  if (roster.isPending || wellness.isPending || logs.isPending || plan.isPending) return <Loading />
  if (roster.isError || wellness.isError || logs.isError || plan.isError) return <p>Impossible de charger les données du jour.</p>
  const weekType = ref.data ? weekOf(ref.data.weeks, today)?.week_type_code : undefined
  const wt = ref.data ? ref.data.weekTypes.find(t => t.code === weekType) ?? null : null
  const load = (p: (typeof roster.data)[number]) => {
    if (!weekLogs.data || !ref.data) return null
    const types = ref.data.types
    const own = weekLogs.data.filter(l => l.player_id === p.id)
    const total = Math.round(own.reduce((n, l) => n + Number(l.srpe ?? 0), 0))
    // Séances d'hier et d'aujourd'hui à signaler : UA au-dessus du seuil de l'activité, ou RPE à ±2 du RPE visé
    const flagged = own.filter(l => l.session_date >= yesterday).flatMap(l => {
      const type = types.find(t => t.id === l.activity_type_id)
      const { range, maxLoad } = sessionTarget(l, weekPlan.data ?? [], weekType, targets.data ?? [])
      const ua = overLoad(Number(l.srpe ?? 0), maxLoad)
      const gap = rpeGap(l.rpe, range)?.heat ?? null
      const heat: Heat | null = ua === 'bad' || gap === 'bad' ? 'bad' : ua || gap
      return heat ? [{ name: type?.name ?? '—', srpe: Math.round(Number(l.srpe ?? 0)), rpe: rpeVsTarget(l.rpe, range), heat, max: maxLoad }] : []
    })
    return { total, pace: weekPace(p, total, weekPlan.data ?? [], today, wt), flagged }
  }

  const todayW = wellness.data.filter(w => w.entry_date === today)
  const byPlayer = new Map(todayW.map(w => [w.player_id, w]))
  const rows = roster.data.map(p => {
    const w = byPlayer.get(p.id)
    return { player: p, w, alerts: w ? wellnessAlerts(w) : [] }
  })
  // Alertes d'abord, puis forme non remplie, puis les autres par fatigue décroissante
  const rank = (r: (typeof rows)[number]) => (r.alerts.length ? 0 : !r.w ? 1 : 2)
  rows.sort((a, b) => rank(a) - rank(b) || (a.w?.score ?? 99) - (b.w?.score ?? 99))
  const filled = rows.filter(r => r.w).length
  const alerted = rows.filter(r => r.alerts.length)
  // Homonymes : le poste départage deux joueurs au même nom dans les listes
  const label = (p: Player) => roster.data.filter(x => fullName(x) === fullName(p)).length > 1 ? `${fullName(p)} (${p.position ?? 'poste ?'})` : fullName(p)
  const late = latecomers(roster.data, todayW, plan.data, logs.data, today, recentSkips.data ?? [])
  const level = (r: (typeof rows)[number]) => (r.w?.score != null ? LEVELS[postureOf(fatiguePercent(r.w.score))].id : null)
  const shown = rows.filter(r => filter === 'tous' || (filter === 'alertes' ? r.alerts.length > 0 : filter === 'non-remplis' ? !r.w : level(r) === filter))
  const mean = groupFatigue(rows)
  const donut = [...LEVELS.map(l => ({ ...l, count: rows.filter(r => level(r) === l.id).length })),
    { id: 'non-remplis' as const, label: 'Non rempli', color: BRAND.muted, count: rows.length - filled }].filter(x => x.count > 0)

  // Tendances des 7 derniers jours (aujourd'hui en dernier) : remplis, alertes, fatigue moyenne
  const trend = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map(d => {
    const ws = wellness.data.filter(w => w.entry_date === d)
    const pcts = ws.flatMap(w => (w.score != null ? [fatiguePercent(w.score)] : []))
    return { day: shortDay(d), filled: ws.length, alerts: ws.filter(w => wellnessAlerts(w).length).length,
      fatigue: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null }
  })
  const [prev, cur] = [trend[5], trend[6]]
  const series = (k: 'filled' | 'alerts' | 'fatigue') => trend.map(t => ({ day: t.day, value: t[k] }))

  return (
    <>
      {/* Bonjour, puis la lecture du jour en une phrase : ce qu'il faut savoir avant de regarder le détail */}
      <header className="rise flex flex-col gap-1">
        <p className="text-sm text-ink/55 first-letter:uppercase">{formatDay(today)}</p>
        <h1 className="font-display text-3xl font-bold leading-tight">Bonjour {me.data?.first_name}</h1>
        <p className="max-w-4xl text-base leading-snug text-ink/80">
          <strong className="text-ink">{filled} joueur{filled > 1 ? 's' : ''} sur {rows.length}</strong> {filled > 1 ? 'ont' : 'a'} rempli {filled > 1 ? 'leur' : 'son'} état de forme.{' '}
          {/* 3 noms au plus, avec leur premier motif : la phrase reste courte quel que soit le nombre d'alertes (détail : filtre « Alertes ») */}
          {alerted.length === 0 ? 'Aucune alerte.' : <>
            <strong className="text-rnr">{alerted.length} alerte{alerted.length > 1 ? 's' : ''}</strong> :{' '}
            {alerted.slice(0, 3).map((r, i) => <span key={r.player.id}>{i > 0 && ', '}<Link to={`/staff/joueur/${r.player.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">{label(r.player)}</Link> ({r.alerts[0].toLowerCase()})</span>)}
            {alerted.length > 3 ? <> et {alerted.length - 3} autre{alerted.length > 4 ? 's' : ''}.</> : '.'}
          </>}
          {roster.data.some(p => p.injured) && <> {roster.data.filter(p => p.injured).length} blessé{roster.data.filter(p => p.injured).length > 1 ? 's' : ''}.</>}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard order={1} label="États de forme remplis" value={filled} suffix={` / ${rows.length}`} delta={cur.filled - prev.filled} better="up" trend={series('filled')} color={BRAND.ok} />
        <StatCard order={2} label="Alertes" value={alerted.length} delta={cur.alerts - prev.alerts} better="down" trend={series('alerts')} color={BRAND.rnr} />
        <StatCard order={3} label="Fatigue moyenne" value={mean} suffix=" %" delta={cur.fatigue !== null && prev.fatigue !== null ? cur.fatigue - prev.fatigue : null} better="down" trend={series('fatigue')} color={BRAND.gold} />
        <StatCard order={4} label="À relancer" value={late.length} color={BRAND.muted} hint="Oubli d'une saisie hier ou aujourd'hui (liste à droite)." />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rise min-w-0" style={{ animationDelay: '320ms' }}>
        <Card boxed title="État de forme du jour"
          help="Chaque question de 1 (mauvais) à 5 (bon) : 2 en jaune, 1 en rouge. Alerte (ligne teintée) : score sous 16/30 ou une réponse à 1. Cloche barrée : rappel du matin non activé. Un nom ouvre la fiche."
          aside={(
            <ViewSelect label="Afficher" value={filter} onChange={setFilter}>
              <option value="tous">Tous ({rows.length})</option>
              <option value="alertes">Alertes ({alerted.length})</option>
              <option value="non-remplis">Non remplis ({rows.length - filled})</option>
              {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label} ({rows.filter(r => level(r) === l.id).length})</option>)}
            </ViewSelect>
          )}>
          <div className="relative">
          {/* Petit écran : un dégradé au bord droit signale que le tableau défile */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-surface xl:hidden" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink/55">
                <tr>
                  <th className="py-2 pr-3 font-normal">Joueur</th>
                  <th className="pr-3 font-normal">Fatigue estimée</th>
                  <th className="pr-3 font-normal">Score</th>
                  {WELLNESS_ITEMS.map(i => <th key={i.key} className="px-1 text-center font-normal">{SHORT[i.key] ?? i.label}</th>)}
                  <th className="pl-2 font-normal" title="Charge de la semaine en cours ; pastille rouge et % : au-dessus du rythme de la semaine (charge visée au prorata du planning passé). Nombre à côté (clic pour le détail) : séances d'hier ou d'aujourd'hui au-dessus de leur seuil (haut de la fourchette de RPE visé × durée prévue), ou dont le RPE est à ±2 de la fourchette (rouge à ±3), avec le RPE déclaré et la fourchette visée.">Charge sem.</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ player, w, alerts }) => {
                  const pct = w?.score != null ? fatiguePercent(w.score) : null
                  return (
                    // Alerte : ligne teintée, motif en infobulle ; la réponse à 1 est déjà en rouge dans sa colonne, le score sous 16 aussi
                    <tr key={player.id} className={`border-t border-line ${alerts.length ? 'bg-rnr/[0.07]' : ''}`} title={alerts.length ? `Alerte : ${alerts.join(', ')}` : undefined}>
                      <td className="min-w-[12rem] max-w-[18rem] py-1.5 pr-3">
                        <Link to={`/staff/joueur/${player.id}`} className="flex items-center gap-2 font-semibold underline-offset-4 hover:underline"><Avatar id={player.id} name={fullName(player)} className="h-7 w-7" /><span className="min-w-0">{fullName(player)}</span></Link>
                        <span className="ml-2 text-xs text-ink/50">{player.position}</span>
                        {player.injured && <span className="ml-2"><Badge tone="warn">blessé</Badge></span>}
                        {alerts.length > 0 && <span className="sr-only">Alerte : {alerts.join(', ')}</span>}
                        {/* rappel du matin non activé sur son téléphone : petite cloche barrée (rien si activé) */}
                        {!push.isError && push.data && !push.data.has(player.id) && <span className="ml-2 inline-flex align-middle text-ink/35" title="Rappel du matin non activé"><BellOff size={13} aria-hidden="true" /><span className="sr-only">rappel du matin non activé</span></span>}
                      </td>
                      <td className="pr-3">
                        {pct === null ? <span className="text-ink/50">non rempli</span> : (
                          <span className="flex items-center gap-2" title="Estimation d'après les 6 réponses : 0 % = en pleine forme, 100 % = épuisé">
                            <span className="h-1.5 w-12 rounded-full bg-field" aria-hidden="true">
                              <span className={`block h-full rounded-full ${BAR[postureOf(pct)]}`} style={{ width: `${Math.max(pct, 4)}%` }} />
                            </span>
                            <span className="whitespace-nowrap tabular-nums">{pct} %</span>
                          </span>
                        )}
                      </td>
                      <td className="pr-3 tabular-nums">{w?.score != null ? <><span className={`font-semibold ${w.score < WELLNESS_ALERT_SCORE ? 'text-rnr' : ''}`}>{w.score}</span><span className="text-ink/50">/30</span></> : '—'}</td>
                      {WELLNESS_ITEMS.map(i => {
                        const v = w ? itemValue(w, i.key) : null
                        return <td key={i.key} className={`px-1 text-center tabular-nums ${v !== null ? itemLook(v) : 'text-ink/30'}`}>{v ?? '·'}</td>
                      })}
                      <td className="pl-2 text-xs"><LoadCell load={load(player)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {shown.length === 0 && <p className="py-3 text-sm text-ink/60">Personne dans cette catégorie.</p>}
          </div>
          </div>
        </Card>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rise" style={{ animationDelay: '400ms' }}>
            <Card boxed title="Forme du groupe" help="Fatigue estimée de chaque joueur aujourd'hui. Cliquez une part pour filtrer le tableau.">
              <div className="relative h-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={donut} dataKey="count" nameKey="label" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none"
                      onClick={(_, i) => setFilter(donut[i].id)} className="cursor-pointer" animationDuration={900}>
                      {donut.map(x => <Cell key={x.id} fill={x.color} opacity={filter === 'tous' || filter === x.id ? 1 : 0.35} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} joueur${Number(v) > 1 ? 's' : ''}`, String(n)]}
                      contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: 'rgb(var(--ink))' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-3xl font-semibold leading-none tabular-nums">{mean ?? '—'}{mean !== null && <span className="text-base text-ink/60"> %</span>}</span>
                  <span className="text-xs text-ink/55">fatigue moyenne</span>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                {donut.map(x => (
                  <li key={x.id}>
                    <button type="button" onClick={() => setFilter(filter === x.id ? 'tous' : x.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left hover:bg-field ${filter === x.id ? 'bg-field font-semibold' : ''}`}>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: x.color }} aria-hidden="true" />
                      <span className="flex-1 leading-tight">{x.label}</span><span className="tabular-nums text-ink/70">{x.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="rise" style={{ animationDelay: '440ms' }}>
            <MissingRpeCard label={label} data={recentLogs.data && recentPlan.data && recentSkips.data && ref.data
              ? missingRpe(roster.data, recentPlan.data, recentLogs.data, ref.data.types, addDays(today, -7), yesterday, recentSkips.data) : null}
              skips={recentSkips.data && ref.data ? recentSkips.data.map(k => ({ ...k, player: roster.data.find(p => p.id === k.player_id),
                activity: ref.data.types.find(t => t.id === k.activity_type_id)?.name ?? '' })) : null} />
          </div>

          <div className="rise" style={{ animationDelay: '480ms' }}>
        <Card boxed title={`À relancer (${late.length})`}
          help="Ont oublié une saisie hier ou aujourd'hui. « Relancer » : le joueur voit un bandeau dans l'app et peut déclarer sa journée d'hier jusqu'à minuit. « Copier » : message à envoyer vous-même.">
          {late.length === 0 && <p className="text-sm text-ok">Tout le monde est à jour.</p>}
          <ul className="flex flex-col">
            {(allLate ? late : late.slice(0, 6)).map(({ player, missing }) => (
              <Reminder key={player.id} playerId={player.id} name={label(player)} missing={missing} message={reminderMessage(player, missing)}
                yesterday={missing.includes('RPE d\'hier') ? yesterday : null} reminded={reminded.data?.includes(player.id) ?? false} />
            ))}
          </ul>
          <MoreButton hidden={late.length - 6} open={allLate} onToggle={() => setAllLate(!allLate)} />
        </Card>
          </div>
        </div>
      </div>
    </>
  )
}

// Charge de la semaine : total (pastille si au-dessus du rythme), puis séances d'hier / aujourd'hui à signaler repliées
// derrière leur nombre : la ligne du tableau garde sa hauteur, le détail s'ouvre au clic
function LoadCell({ load }: { load: { total: number; pace: ReturnType<typeof weekPace>; flagged: { name: string; srpe: number; rpe: string; heat: Heat; max: number | null }[] } | null }) {
  const [open, setOpen] = useState(false)
  if (!load) return <span className="text-ink/45">…</span>
  const { total, pace, flagged } = load
  const worst: Heat = flagged.some(h => h.heat === 'bad') ? 'bad' : 'warn'
  return (
    <span className="flex flex-col items-start gap-1 whitespace-nowrap">
      <span className="flex items-center gap-1.5" title={pace ? `${total} UA pour ${pace.limit} au rythme de la semaine (${pace.share} % du planning passé)` : undefined}>
        {pace?.over ? <Badge tone="bad">{total.toLocaleString('fr-FR')} UA · {pace.pct} %</Badge> : <span className="tabular-nums">{total.toLocaleString('fr-FR')} UA</span>}
        {flagged.length > 0 && (
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="rounded-full hover:opacity-80"
            aria-label={`${flagged.length} séance${flagged.length > 1 ? 's' : ''} d'hier ou d'aujourd'hui à signaler : détails`} title="Séances d'hier ou d'aujourd'hui à signaler">
            <Badge tone={worst}>{flagged.length}<ChevronDown size={12} aria-hidden="true" className={open ? 'rotate-180' : ''} /></Badge>
          </button>
        )}
      </span>
      {open && flagged.map((h, i) => (
        <span key={i} className="text-ink/80" title={h.max ? `Seuil ${h.name} : ${h.max} UA` : undefined}>
          <span aria-hidden="true" className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${h.heat === 'bad' ? 'bg-rnr' : 'bg-gold'}`} />
          {h.name} {h.srpe} UA{h.rpe && <span className="text-ink/60"> · {h.rpe}</span>}
        </span>
      ))}
    </span>
  )
}

// Les joueurs qui ne déclarent pas leur RPE : nombre d'oublis sur les 7 derniers jours ; le jour par jour au clic, 5 joueurs d'abord
type SkipRow = { player_id: string; session_date: string; activity: string; reason: string; note: string | null; player?: Player }

export function MissingRpeCard({ data, skips, label = fullName, title = 'RPE non déclarés (7 derniers jours)' }: {
  data: ReturnType<typeof missingRpe> | null; skips?: SkipRow[] | null; title?: string; label?: (p: Player) => string
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  // « Je n'ai pas fait » : pas un oubli, listé à part avec la raison, pour vérifier
  const skipList = skips?.filter(k => k.player)
  const skipped = !!skipList?.length && (
    <div className="mt-2 border-t border-line pt-2">
      <p className="text-sm font-semibold">Déclarées non faites · {skipList.length}</p>
      <ul className="flex flex-col text-xs text-ink/70">
        {skipList.map(k => (
          <li key={`${k.player_id}-${k.session_date}-${k.activity}`} className="py-0.5">
            <span className="font-semibold text-ink">{fullName(k.player!)}</span> · {shortDay(k.session_date)} · {k.activity} : {SKIP_REASONS[k.reason as SkipReason] ?? k.reason}{k.note ? ` (${k.note})` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
  return (
    <Card boxed title={data ? `${title} · ${data.length}` : title}
      help="Activités prévues avec RPE sans déclaration, et séances de musculation non validées. Une activité que le joueur a déclarée « pas faite » n'est pas un oubli : elle est listée à part, avec sa raison. Le joueur ne peut rattraper que la veille, après une relance : au-delà, la saisie se fait par le staff dans sa fiche.">
      {!data ? <p className="text-sm text-ink/45">…</p> : !data.length ? <><p className="text-sm text-ok">Tous les RPE prévus ont été déclarés.</p>{skipped}</> : (
        <>
          <ul className="flex flex-col">
            {(all ? data : data.slice(0, 5)).map(({ player, missed, planned, days }) => (
              <li key={player.id} className="border-t border-line/60 py-1.5 text-sm">
                <button type="button" onClick={() => setOpen(open === player.id ? null : player.id)} aria-expanded={open === player.id}
                  className="flex w-full items-center justify-between gap-2 text-left">
                  <span className="flex min-w-0 items-center gap-2 font-semibold"><Avatar id={player.id} name={fullName(player)} className="h-6 w-6" /><span className="truncate" title={label(player)}>{label(player)}</span></span>
                  <Badge tone={missed / planned >= 0.25 ? 'bad' : 'warn'}>{missed} oubli{missed > 1 ? 's' : ''} sur {planned}</Badge>
                </button>
                {open === player.id && (
                  <span className="mt-1 flex flex-col gap-0.5 text-xs text-ink/65">
                    {days.map(d => <span key={d.date}>{shortDay(d.date)} : {d.missing.join(', ')}</span>)}
                    <Link to={`/staff/joueur/${player.id}`} className="text-gold hover:underline">Ouvrir sa fiche</Link>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <MoreButton hidden={data.length - 5} open={all} onToggle={() => setAll(!all)} />
          {skipped}
        </>
      )}
    </Card>
  )
}

// Moyenne de fatigue estimée du groupe, pour situer chaque joueur
function groupFatigue(rows: { w?: { score: number | null } }[]) {
  const scores = rows.flatMap(r => (r.w?.score != null ? [r.w.score] : []))
  return scores.length ? Math.round(scores.reduce((s, v) => s + fatiguePercent(v), 0) / scores.length) : null
}

function Reminder({ playerId, name, missing, message, yesterday, reminded }: {
  playerId: string; name: string; missing: string[]; message: string; yesterday: string | null; reminded: boolean
}) {
  const remind = useRemind()
  const [copied, setCopied] = useState<boolean | null>(null)
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setCopied(true) } catch { setCopied(false) }
    setTimeout(() => setCopied(null), 2500)
  }
  return (
    <li className="flex items-center justify-between gap-2 border-t border-line/60 py-1.5">
      <span className="min-w-0 text-sm">
        <span className="block truncate font-semibold" title={name}>{name}</span>
        <span className="block truncate text-xs text-ink/55" title={missing.join(', ')}>{missing.join(', ')}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
      {yesterday && (reminded
        ? <span className="inline-flex items-center gap-1 text-xs text-ok"><Check size={14} aria-hidden="true" />Relancé</span>
        : (
          <button type="button" disabled={remind.isPending} onClick={() => remind.mutate({ playerId, date: yesterday })} aria-label={`Relancer ${name} dans l'app pour son RPE d'hier`}
            title="Le joueur voit un bandeau et peut déclarer sa journée d'hier"
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${remind.isError ? 'border-rnr text-rnr' : 'border-line hover:border-ink/40'}`}>
            <BellRing size={14} aria-hidden="true" /><span className="sr-only sm:not-sr-only">{remind.isError ? 'Réessayer' : 'Relancer'}</span>
          </button>
        ))}
      <button type="button" onClick={copy} aria-label={`Copier le message pour ${name}`}
        title="Copier un message à envoyer soi-même"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${copied ? 'border-ok text-ok' : 'border-line hover:border-ink/40'}`}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {copied === null ? <span className="sr-only">Copier</span> : copied ? 'Copié' : 'Impossible'}
      </button>
      </span>
    </li>
  )
}

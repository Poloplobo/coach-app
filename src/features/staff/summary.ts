// Résumés du bloc, du cycle et du coach : fonctions pures, testées. Mêmes calculs que les écrans (load.ts, muscu.ts,
// performance/report.ts) : un chiffre du PDF est le chiffre de l'app.
import { addDays, parisDate } from '../../lib/week'
import type { GpsRecord, GpsReference, RatingColor } from '../performance/gps'
import { playerReport } from '../performance/report'
import { fatiguePercent } from '../wellness/fatigue'
import { WELLNESS_ITEMS } from '../wellness/items'
import { acwr, declarationRate, fullName, itemValue, loadStatus, wellnessAlerts, type ActivityType, type Log, type PlanItem, type Player, type Skip, type Status, type WeekType, type WellnessScores } from './load'
import { ACTIVITIES, LOCATIONS, MECHANISMS, TISSUES, type InjuryRecord } from './medical'
import { muscuSummary, type StaffMuscuSession } from './muscu'
import { SUMMARY, toneHigh, toneLow, type Tone } from './summaryConfig'

export type Week = { code: string; label: string | null; start_date: string; week_type_code: string; cycle: string | null; block?: number | null }
export type Block = { block: number; cycle: string | null; rank: number; weeks: Week[]; from: string; to: string }
export type Wellness = WellnessScores & { player_id: string; entry_date: string }
type Match = { id: string; match_date: string; opponent: string; label: string | null }
type Rating = { match_id: string; player_id: string; rater: 'player' | 'staff'; color: RatingColor; minutes?: number | null }
type GpsRef = { refs: Map<string, GpsReference>; positions: Map<string, string> }

const round = (v: number, digits = 0) => Math.round(v * 10 ** digits) / 10 ** digits
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null)
const sum = (logs: Log[]) => logs.reduce((s, l) => s + Number(l.srpe ?? 0), 0)
const between = (d: string, from: string, to: string) => d >= from && d <= to
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
const pctChange = (now: number, before: number | null) => (before ? round((100 * (now - before)) / before) : null)

// Blocs de la saison, d'après le numéro porté par chaque semaine (Programmation › Semaines). Une semaine sans bloc est
// ignorée. Le cycle d'un bloc est celui de sa première semaine ; rank = sa place dans ce cycle (1, 2, 3…).
export function blocksOf(weeks: Week[]): Block[] {
  const sorted = [...weeks].filter(w => w.block != null).sort((a, b) => a.start_date.localeCompare(b.start_date))
  const blocks: Block[] = []
  for (const n of [...new Set(sorted.map(w => w.block!))]) {
    const own = sorted.filter(w => w.block === n)
    const cycle = own[0].cycle
    blocks.push({ block: n, cycle, rank: blocks.filter(b => b.cycle === cycle).length + 1, weeks: own, from: own[0].start_date, to: addDays(own.at(-1)!.start_date, 6) })
  }
  return blocks
}

// Charge (sRPE = RPE × durée) de chaque semaine face à sa cible. Semaine en cours : pas de statut (un mercredi, tout le
// monde serait en sous-charge), comme dans la vue Semaine. Semaine pas commencée : future.
export function weeklyLoad(weeks: Week[], weekTypes: WeekType[], logs: Log[], today = parisDate()) {
  return weeks.map(w => {
    const wt = weekTypes.find(t => t.code === w.week_type_code) ?? null
    const total = sum(logs.filter(l => between(l.session_date, w.start_date, addDays(w.start_date, 6))))
    const future = w.start_date > today
    const inProgress = !future && addDays(w.start_date, 6) >= today
    return { code: w.code, type: w.week_type_code, total, target: wt?.target_srpe ?? 0, min: wt?.srpe_min ?? null, max: wt?.srpe_max ?? null,
      inProgress, future, status: (inProgress || future ? null : loadStatus(total, wt)) as Status | null }
  })
}

// Alertes d'état de forme d'une période : un jour compte dès qu'il déclenche l'alerte de l'app (score < 16/30 ou un item à 1).
// zones : items notés 1, du plus fréquent au moins fréquent (« Courbatures bas du corps × 2 »).
export function wellnessSummary(entries: Wellness[]) {
  const scores = entries.map(e => e.score).filter((s): s is number => s != null)
  const alerts = entries.map(e => ({ player_id: e.player_id, date: e.entry_date, reasons: wellnessAlerts(e) })).filter(a => a.reasons.length)
    .sort((a, b) => a.date.localeCompare(b.date))
  const zones = WELLNESS_ITEMS.map(i => ({ label: i.label, count: entries.filter(e => itemValue(e, i.key) === 1).length }))
    .filter(z => z.count).sort((a, b) => b.count - a.count)
  return { entries: entries.length, fatigue: scores.length ? fatiguePercent(round(mean(scores)!, 1)) : null, alerts, zones }
}

// Blessures qui touchent la période : survenues avant sa fin et pas terminées avant son début
export function injuriesIn(injuries: InjuryRecord[], from: string, to: string, today = parisDate()) {
  const label = <T extends Record<string, string>>(map: T, key: string | null) => (key && key in map ? map[key as keyof T] : null)
  return injuries.filter(i => i.occurred_on <= to && (i.ended_on ?? today) >= from)
    .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on))
    .map(i => ({
      player_id: i.player_id, occurred_on: i.occurred_on,
      what: [label(LOCATIONS, i.location), label(TISSUES, i.tissue)].filter(Boolean).join(' · ') || null,
      context: [label(ACTIVITIES, i.activity), label(MECHANISMS, i.mechanism)].filter(Boolean).join(' · ') || null,
      days: days(i.occurred_on, i.ended_on ?? today), ongoing: i.ended_on === null, recurrence: i.recurrence,
      // jours d'arrêt tombés dans la période : une blessure à cheval sur deux blocs n'est pas comptée en entier dans chacun
      daysIn: days(i.occurred_on > from ? i.occurred_on : from, (i.ended_on ?? today) < to ? (i.ended_on ?? today) : to),
    }))
}

// Séances de musculation prévues sur la période (jusqu'à aujourd'hui) et celles que le joueur a faites : séance déclarée
// (RPE de séance), ou au moins un exercice noté fait ou partiel
function muscuAttendance(sessions: StaffMuscuSession[], logs: Log[], muscuTypeId: string | undefined, today: string) {
  const due = sessions.filter(s => s.session_date < today)
  const done = due.filter(s => logs.some(l => l.player_id === s.player_id && l.session_date === s.session_date && l.activity_type_id === muscuTypeId)
    || s.planned_exercises.some(e => ['fait', 'partiel'].includes(e.exercise_feedback[0]?.status ?? '')))
  return { planned: due.length, attended: done.length, rate: due.length ? round((100 * done.length) / due.length) : null }
}

export type PlayerInput = {
  player: Player; weekTypes: WeekType[]; logs: Log[]; wellness: Wellness[]; muscu: StaffMuscuSession[]; muscuTypeId: string | undefined
  matches: Match[]; gps: GpsRecord[]; ratings: Rating[]; gpsRef: GpsRef; injuries: InjuryRecord[]; today?: string
}

// Résumé d'un joueur sur un bloc. previous : le bloc d'avant, pour l'évolution de la charge. Toutes les listes reçues
// sont celles du joueur ; rien n'est exigé : une donnée absente donne null ou une liste vide (« Non renseigné »).
export function blockSummary(input: PlayerInput & { block: Block; previous?: Block | null }) {
  const { block, previous, player, today = parisDate() } = input
  // Appartenance aux semaines du bloc, pas à l'intervalle : un bloc non contigu ne compte pas les semaines d'un autre
  const inBlock = (d: string) => block.weeks.some(w => between(d, w.start_date, addDays(w.start_date, 6)))
  const logs = input.logs.filter(l => inBlock(l.session_date))
  const weekly = weeklyLoad(block.weeks, input.weekTypes, logs, today)
  const total = sum(logs)
  const previousTotal = previous ? sum(input.logs.filter(l => between(l.session_date, previous.from, previous.to))) : null
  // Les blocs n'ont pas tous la même longueur : on compare la charge moyenne par semaine terminée, pas les totaux
  // (la semaine en cours, incomplète, ferait croire à une baisse)
  const ended = weekly.filter(w => !w.future && !w.inProgress)
  const perWeek = ended.length ? round(ended.reduce((s, w) => s + w.total, 0) / ended.length) : null
  const previousPerWeek = previous && previousTotal ? round(previousTotal / previous.weeks.length) : null
  // Semaines de match face à la semaine de repos (Régénération) : seulement les semaines terminées
  const finished = ended
  const rest = mean(finished.filter(w => w.type === 'REG').map(w => w.total))
  const work = mean(finished.filter(w => w.type !== 'REG').map(w => w.total))

  const matches = input.matches.filter(m => inBlock(m.match_date)).sort((a, b) => a.match_date.localeCompare(b.match_date))
  const gps = playerReport({ player, matches, records: input.gps.filter(r => matches.some(m => m.id === r.match_id)), ref: input.gpsRef })
  const notes = matches.map(m => {
    const of = (rater: 'player' | 'staff') => input.ratings.find(r => r.match_id === m.id && r.rater === rater) ?? null
    const record = gps.history.find(h => h.match.id === m.id)?.record ?? null
    return { match: m, staff: of('staff')?.color ?? null, player: of('player')?.color ?? null, minutes: of('staff')?.minutes ?? record?.minutes ?? null }
  })

  const sessions = input.muscu.filter(s => inBlock(s.session_date) && s.session_date < today) // séances échues : même base que les présences
  const sessionRpes = logs.filter(l => l.activity_type_id === input.muscuTypeId && l.rpe !== null).map(l => Number(l.rpe))
  const muscu = { ...muscuSummary(sessions, sessionRpes), ...muscuAttendance(sessions, logs, input.muscuTypeId, today) }
  const wellness = wellnessSummary(input.wellness.filter(w => inBlock(w.entry_date)))
  const injuries = injuriesIn(input.injuries, block.from, block.to < today ? block.to : today, today)

  const result = {
    block, inProgress: block.to >= today, weekly, total, previousTotal, totalChangePct: pctChange(total, previousTotal), perWeek, previousPerWeek, changePct: perWeek === null ? null : pctChange(perWeek, previousPerWeek),
    rest: rest === null ? null : round(rest), work: work === null ? null : round(work), gps, notes, muscu, wellness, injuries,
  }
  return { ...result, highlights: highlights(result, previous ?? null) }
}

// Synthèse automatique : 3 à 5 constats, les plus utiles d'abord (charge, blessure, état de forme, musculation, GPS)
function highlights(r: {
  block: Block; weekly: ReturnType<typeof weeklyLoad>; total: number; changePct: number | null
  muscu: { rate: number | null; attended: number; planned: number }; wellness: ReturnType<typeof wellnessSummary>
  injuries: ReturnType<typeof injuriesIn>; gps: { axis: string | null; played: number }
}, previous: Block | null) {
  const out: string[] = []
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`
  if (r.changePct !== null && Math.abs(r.changePct) >= SUMMARY.loadChangePct)
    out.push(`Charge moyenne par semaine en ${r.changePct > 0 ? 'hausse' : 'baisse'} de ${Math.abs(r.changePct)} % par rapport au bloc ${previous!.block}.`)
  const off = r.weekly.filter(w => w.status && w.status !== 'conforme')
  if (off.length) out.push(`${plural(off.length, 'semaine')} hors de la plage de charge : ${off.map(w => `${w.code} en ${w.status}`).join(', ')}.`)
  else if (r.weekly.some(w => w.status)) out.push('Charge dans la plage visée sur toutes les semaines terminées.')
  for (const i of r.injuries.slice(0, 1)) out.push(`Blessure${i.what ? ` (${i.what.toLowerCase()})` : ''} : ${plural(i.days, 'jour')} d'arrêt${i.ongoing ? ', en cours' : ''}.`)
  if (r.wellness.alerts.length)
    out.push(`${plural(r.wellness.alerts.length, 'alerte')} d'état de forme${r.wellness.zones.length ? ` (${r.wellness.zones.slice(0, 2).map(z => `${z.label.toLowerCase()} × ${z.count}`).join(', ')})` : ''}.`)
  else if (r.wellness.entries) out.push('Aucune alerte d\'état de forme.')
  if (r.muscu.rate !== null) out.push(`Musculation : ${r.muscu.attended} séance${r.muscu.attended > 1 ? 's' : ''} sur ${r.muscu.planned} (${r.muscu.rate} %).`)
  if (r.gps.axis && r.gps.played) out.push(`GPS : axe de travail, ${r.gps.axis.toLowerCase()}.`)
  if (!out.length) out.push('Pas assez de données sur ce bloc pour une synthèse.')
  return out.slice(0, 5)
}

// Le bloc d'avant dans la saison, par position et non par numéro (les numéros peuvent sauter : 1, 2, 4)
export const previousBlock = (all: Block[], block: Block) => all[all.findIndex(b => b.block === block.block) - 1] ?? null

// Résumé du cycle : un résumé de bloc par bloc du cycle (une colonne ou un point de courbe chacun)
export function cycleSummary(input: PlayerInput & { blocks: Block[]; allBlocks: Block[] }) {
  return input.blocks.map(block => blockSummary({ ...input, block, previous: previousBlock(input.allBlocks, block) }))
}

// Synthèse du cycle : la tendance entre le premier et le dernier bloc, puis les totaux
export function cycleHighlights(blocks: ReturnType<typeof cycleSummary>) {
  const out: string[] = []
  const done = blocks.filter(b => !b.inProgress)
  const first = done[0], last = done.at(-1)
  if (first && last && first !== last) {
    const change = last.perWeek === null ? null : pctChange(last.perWeek, first.perWeek)
    if (change) out.push(`Charge moyenne par semaine du bloc ${last.block.block} ${change >= 0 ? 'supérieure' : 'inférieure'} de ${Math.abs(change)} % à celle du bloc ${first.block.block}.`)
    if (first.wellness.fatigue !== null && last.wellness.fatigue !== null)
      out.push(`Fatigue moyenne : ${first.wellness.fatigue} % au bloc ${first.block.block}, ${last.wellness.fatigue} % au bloc ${last.block.block}.`)
  }
  const off = blocks.flatMap(b => b.weekly).filter(w => w.status && w.status !== 'conforme').length
  const judged = blocks.flatMap(b => b.weekly).filter(w => w.status).length
  if (judged) out.push(off ? `${off} semaine${off > 1 ? 's' : ''} sur ${judged} hors de la plage de charge.` : 'Charge dans la plage visée sur toutes les semaines terminées.')
  const alerts = blocks.reduce((n, b) => n + b.wellness.alerts.length, 0)
  if (blocks.some(b => b.wellness.entries)) out.push(alerts ? `${alerts} alerte${alerts > 1 ? 's' : ''} d'état de forme sur le cycle.` : 'Aucune alerte d\'état de forme sur le cycle.')
  const planned = blocks.reduce((n, b) => n + b.muscu.planned, 0), doneSessions = blocks.reduce((n, b) => n + b.muscu.attended, 0)
  if (planned) out.push(`Musculation : ${doneSessions} séance${doneSessions > 1 ? 's' : ''} sur ${planned} (${round((100 * doneSessions) / planned)} %).`)
  // une même blessure touche plusieurs blocs : comptée une fois
  const injuries = [...new Map(blocks.flatMap(b => b.injuries).map(i => [i.occurred_on, i])).values()]
  if (injuries.length) out.push(`${injuries.length} blessure${injuries.length > 1 ? 's' : ''} : ${injuries.reduce((n, i) => n + i.days, 0)} jours d'arrêt au total.`)
  if (!out.length) out.push('Pas assez de données sur ce cycle pour une synthèse.')
  return out.slice(0, 5)
}

// Résumé coach sur une suite de semaines (un bloc ou un cycle) : charge moyenne par semaine, puis une ligne par joueur.
// Les listes reçues couvrent tout l'effectif. logs remonte au moins 28 jours avant la période si withRatio (admins).
export function coachSummary(input: {
  players: Player[]; weeks: Week[]; weekTypes: WeekType[]; logs: Log[]; wellness: Wellness[]; plan: PlanItem[]; skips: Skip[]
  types: ActivityType[]; muscu: StaffMuscuSession[]; muscuTypeId: string | undefined; injuries: InjuryRecord[]; withRatio: boolean; today?: string
}) {
  const { players, today = parisDate() } = input
  const weeks = [...input.weeks].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const from = weeks[0]?.start_date ?? today
  const end = weeks.length ? addDays(weeks.at(-1)!.start_date, 6) : today
  const to = end < today ? end : today
  const logs = input.logs.filter(l => between(l.session_date, from, to))
  const injuries = injuriesIn(input.injuries, from, to, today)
  const injuredOn = (id: string) => (d: string) => input.injuries.some(i => i.player_id === id && i.occurred_on <= d && (i.ended_on ?? today) >= d)
  const activeDays = new Set(logs.map(l => l.session_date))
  const name = (id: string) => { const p = players.find(x => x.id === id); return p ? fullName(p) : 'Joueur' }

  const rows = players.map(player => {
    const own = logs.filter(l => l.player_id === player.id)
    const weekly = weeklyLoad(weeks, input.weekTypes, own, today)
    const judged = weekly.filter(w => w.status)
    const over = judged.filter(w => w.status === 'surcharge').length
    const under = judged.filter(w => w.status === 'sous-charge').length
    const form = wellnessSummary(input.wellness.filter(w => w.player_id === player.id && between(w.entry_date, from, to)))
    const alerts = form.entries ? form.alerts.length : null // aucun état de forme rempli : non renseigné, pas « 0 alerte »
    // Présences : activités prévues et déclarées (séances de groupe et individuelles), jusqu'à hier
    const attendance = declarationRate(player, input.plan, logs, input.types, from, addDays(to, to === today ? -1 : 0), activeDays, injuredOn(player.id), input.skips).rate
    const muscu = muscuAttendance(input.muscu.filter(s => s.player_id === player.id && between(s.session_date, from, to)), own, input.muscuTypeId, today).rate
    const injured = injuries.some(i => i.player_id === player.id)
    const ratio = input.withRatio ? acwr(input.logs.filter(l => l.player_id === player.id), to) : null
    const tones = {
      load: injured ? 'neutral' : toneLow(judged.length ? over + under : null, SUMMARY.weeksOutOfRange),
      alerts: toneLow(alerts, SUMMARY.alerts),
      attendance: toneHigh(attendance, SUMMARY.attendance),
      muscu: toneHigh(muscu, SUMMARY.attendance),
    } satisfies Record<string, Tone>
    const worst: Tone = Object.values(tones).includes('bad') ? 'bad' : Object.values(tones).includes('warn') ? 'warn' : 'ok'
    return { player, weekly, total: sum(own), over, under, alerts, attendance, muscu, injured, ratio, tones, worst }
  }).sort((a, b) => fullName(a.player).localeCompare(fullName(b.player)))

  // Moyenne de l'équipe par semaine : joueurs non blessés sur la période (un blessé fausserait la référence)
  const fit = rows.filter(r => !r.injured)
  const team = weeks.map((w, i) => {
    const base = fit[0]?.weekly[i] ?? weeklyLoad([w], input.weekTypes, [], today)[0]
    const raw = mean(fit.map(r => r.weekly[i].total))
    const meanLoad = round(raw ?? 0)
    const wt = input.weekTypes.find(t => t.code === w.week_type_code) ?? null
    return { ...base, total: meanLoad, status: base.inProgress || base.future || raw === null ? null : loadStatus(raw, wt), // moyenne brute, comme la vue Semaine
      over: fit.filter(r => r.weekly[i].status === 'surcharge').map(r => fullName(r.player)),
      under: fit.filter(r => r.weekly[i].status === 'sous-charge').map(r => fullName(r.player)) }
  })
  const rate = (pick: (r: typeof rows[number]) => number | null) => { const v = mean(rows.map(pick).filter((x): x is number => x !== null)); return v === null ? null : round(v) }
  return {
    from, to: end, inProgress: end >= today, team, rows,
    alerts: wellnessSummary(input.wellness.filter(w => between(w.entry_date, from, to) && players.some(p => p.id === w.player_id))).alerts
      .map(a => ({ ...a, name: name(a.player_id) })),
    injuries: injuries.filter(i => players.some(p => p.id === i.player_id)).map(i => ({ ...i, name: name(i.player_id) })),
    attendance: rate(r => r.attendance), muscu: rate(r => r.muscu),
  }
}

// Calculs du tableau de bord staff, calqués sur les onglets TABLEAU_DE_BORD et SUIVI_INDIVIDUEL du classeur PER.
// Fonctions pures : la vue, l'export Excel et les tests utilisent exactement les mêmes chiffres.
import { addDays } from '../../lib/week'
import { EXERCISE_SESSIONS } from '../rpe/activities'
import { WELLNESS_ITEMS, type WellnessKey } from '../wellness/items'

export type Pillar = 'rugby' | 'physique' | 'accompagnement' | 'ppid'
export type ActivityType = { id: string; name: string; pillar: Pillar; requires_rpe: boolean; default_duration_min?: number | null }
export type Log = {
  player_id: string; session_date: string; activity_type_id: string | null
  duration_min: number; rpe: number | null; srpe: number | null; source: string; created_at: string; validated_at?: string | null
}
export type WeekType = {
  code: string; name: string; target_srpe: number; srpe_min: number | null; srpe_max: number | null
  volume_min: number; physique_min: number; rugby_min: number; accompagnement_min: number; ppid_min: number
}
export type Player = { id: string; first_name: string; last_name: string; position: string | null; injured: boolean }
export type Status = 'sous-charge' | 'conforme' | 'surcharge'

export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const fullName = (p: Pick<Player, 'first_name' | 'last_name'>) => `${p.last_name} ${p.first_name}`
const srpeOf = (l: Log) => Number(l.srpe ?? 0)
const round = (v: number, digits = 0) => Math.round(v * 10 ** digits) / 10 ** digits
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0)

// ---------- Statut de charge : plage du type de semaine (REG 500-1500, COMP 1500-2500, DEV > 2500) ----------

export function loadStatus(srpe: number, wt: Pick<WeekType, 'srpe_min' | 'srpe_max'> | null): Status | null {
  if (!wt) return null
  if (wt.srpe_min !== null && srpe < wt.srpe_min) return 'sous-charge'
  if (wt.srpe_max !== null && srpe > wt.srpe_max) return 'surcharge'
  return 'conforme'
}

export const pctOfTarget = (srpe: number, target: number) => (target > 0 ? round((100 * srpe) / target, 1) : 0)

export const rangeLabel = (wt: Pick<WeekType, 'srpe_min' | 'srpe_max'>) =>
  wt.srpe_max === null ? `> ${wt.srpe_min} UA` : `${wt.srpe_min ?? 0}-${wt.srpe_max} UA`

// Semaine de saison qui contient la date (sinon la dernière commencée, sinon la première)
export function weekOf<W extends { start_date: string }>(weeks: W[], date: string): W | undefined {
  return weeks.find(w => w.start_date <= date && date < addDays(w.start_date, 7))
    ?? [...weeks].reverse().find(w => w.start_date <= date) ?? weeks[0]
}

export const STATUS_TONE = { 'sous-charge': 'warn', conforme: 'ok', surcharge: 'bad' } as const

// ---------- Matrice individuelle de la semaine ----------

export type MatrixRow = {
  player: Player; sessions: number; byDay: number[]; total: number; minutes: number
  pct: number; gap: number; vsGroupPct: number; status: Status | null
}

// inProgress : semaine pas encore terminée. Le statut n'a pas de sens (un lundi matin, tout le monde serait en sous-charge) :
// on garde le % atteint, sans statut ni anomalie.
export function weekMatrix(players: Player[], weekLogs: Log[], weekStart: string, wt: WeekType | null, { inProgress = false } = {}) {
  const dates = DAY_NAMES.map((_, i) => addDays(weekStart, i))
  const target = wt?.target_srpe ?? 0
  const base = players.map(player => {
    const own = weekLogs.filter(l => l.player_id === player.id)
    const byDay = dates.map(d => own.filter(l => l.session_date === d).reduce((s, l) => s + srpeOf(l), 0))
    return {
      player, byDay, total: byDay.reduce((a, b) => a + b, 0), minutes: own.reduce((s, l) => s + l.duration_min, 0),
      sessions: new Set(own.map(l => l.session_date)).size,
    }
  })
  // Moyenne du groupe : joueurs aptes seulement (un blessé fausserait la référence)
  const groupMean = mean(base.filter(r => !r.player.injured).map(r => r.total))
  const rows: MatrixRow[] = base.map(r => ({
    ...r,
    pct: pctOfTarget(r.total, target),
    gap: r.total - target,
    vsGroupPct: groupMean > 0 ? round((100 * (r.total - groupMean)) / groupMean, 1) : 0,
    status: inProgress ? null : loadStatus(r.total, wt),
  }))
  const fit = rows.filter(r => !r.player.injured)
  return {
    rows,
    groupMean: round(groupMean),
    groupPct: pctOfTarget(groupMean, target),
    groupStatus: inProgress ? null : loadStatus(groupMean, wt),
    inProgress,
    dayMeans: dates.map((_, i) => round(mean(fit.filter(r => r.byDay[i] > 0).map(r => r.byDay[i])))),
    // Anomalies : hors plage, blessés exclus des alertes (leur charge réduite est attendue)
    anomalies: fit.filter(r => r.status && r.status !== 'conforme'),
  }
}

// ---------- RPE visé et seuil de charge (0031, 0032) ----------

export type Heat = 'warn' | 'bad'
export type RpeRange = { min: number; max: number }
export type TargetRpe = { week_type_code: string; activity_type_id: string; rpe_min: number; rpe_max: number }
export const OVER_FACTOR = 1.25 // charge : rouge au-delà de 1,25 × le seuil de la séance

export type PlanItem = {
  player_id: string | null; session_date: string; planned_duration_min?: number | null
  activity_type_id?: string | null; planned_rpe?: number | null; planned_rpe_max?: number | null
  activity_types?: { default_duration_min?: number | null } | null
}

// « 5,6 », « 5-6 », « 5/6 », « 5 à 6 » : 5 ou 6 (RPE entiers, échelle de Borg) ; « 4 » : 4 ; vide : null ; sinon 'invalide'
export function parseRpeRange(text: string): RpeRange | null | 'invalide' {
  const t = text.trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2})(?:\s*(?:[-,/]|à|a|\s)\s*(\d{1,2}))?$/i)
  if (!m) return 'invalide'
  const min = Number(m[1]), max = Number(m[2] ?? m[1])
  return min <= max && max <= 10 ? { min, max } : 'invalide'
}
export const formatRange = (r: RpeRange) => (r.min === r.max ? String(r.min) : `${r.min}-${r.max}`)
export const rangeMid = (r: RpeRange) => (r.min + r.max) / 2

// Séance du planning correspondant à une déclaration (même jour, même activité, du groupe ou du joueur)
const plannedFor = (log: Pick<Log, 'player_id' | 'session_date' | 'activity_type_id'>, plan: PlanItem[]) =>
  plan.find(s => s.session_date === log.session_date && s.activity_type_id === log.activity_type_id && (s.player_id === null || s.player_id === log.player_id))

// RPE visé d'une déclaration : la fourchette de la séance du planning si elle en a une, sinon celle du type de semaine.
// Seuil de charge : haut de la fourchette × durée prévue de la séance (activité hors planning : pas de seuil de charge).
export function sessionTarget(log: Pick<Log, 'player_id' | 'session_date' | 'activity_type_id'>, plan: PlanItem[], weekType: string | null | undefined, targets: TargetRpe[]) {
  const planned = plannedFor(log, plan)
  const t = targets.find(x => x.week_type_code === weekType && x.activity_type_id === log.activity_type_id)
  const range: RpeRange | null = planned?.planned_rpe != null ? { min: Number(planned.planned_rpe), max: Number(planned.planned_rpe_max ?? planned.planned_rpe) }
    : t ? { min: t.rpe_min, max: t.rpe_max } : null
  const minutes = planned ? planned.planned_duration_min ?? planned.activity_types?.default_duration_min ?? null : null
  return { range, maxLoad: range && minutes ? range.max * minutes : null }
}

// Charge d'une séance au-dessus de son seuil : orange, puis rouge au-delà de 1,25 × le seuil ; pas de seuil : rien
export function overLoad(srpe: number, max: number | null | undefined): Heat | null {
  if (!max || srpe <= max) return null
  return srpe > max * OVER_FACTOR ? 'bad' : 'warn'
}

// Écart au RPE visé, compté depuis la fourchette (0 dedans) : orange à ±2, rouge à ±3 et plus (décision du 04/11/2026)
export function rpeGap(rpe: number | null, range: RpeRange | null): { gap: number; heat: Heat | null } | null {
  if (rpe === null || range === null) return null
  const r = Number(rpe)
  const gap = r > range.max ? round(r - range.max, 1) : r < range.min ? round(r - range.min, 1) : 0
  return { gap, heat: Math.abs(gap) >= 3 ? 'bad' : Math.abs(gap) >= 2 ? 'warn' : null }
}

// « RPE 6 · visé 3-4 (+2) »
export function rpeVsTarget(rpe: number | null, range: RpeRange | null) {
  if (rpe === null) return ''
  const n = (v: number) => v.toLocaleString('fr-FR')
  if (!range) return `RPE ${n(Number(rpe))}`
  const g = rpeGap(rpe, range)!.gap
  return `RPE ${n(Number(rpe))} · visé ${formatRange(range)}${g ? ` (${g > 0 ? '+' : ''}${n(g)})` : ''}`
}

// Séances d'un joueur au-dessus de leur seuil de charge, la plus chaude d'abord
export function hotSessions(playerLogs: Log[], types: ActivityType[], target: (l: Log) => { maxLoad: number | null }) {
  return playerLogs.flatMap(l => {
    const max = target(l).maxLoad
    const heat = overLoad(srpeOf(l), max)
    const name = types.find(t => t.id === l.activity_type_id)?.name ?? '—'
    return heat && max ? [{ date: l.session_date, name, srpe: srpeOf(l), max, heat }] : []
  }).sort((a, b) => b.srpe / b.max - a.srpe / a.max)
}

// Charge prévue si les RPE visés sont respectés : milieu de la fourchette × minutes (sans RPE visé : non comptée)
export const plannedLoad = (items: { minutes: number; range: RpeRange | null }[]) => Math.round(items.reduce((n, i) => n + (i.range ? rangeMid(i.range) : 0) * i.minutes, 0))

// Rythme de la semaine en cours : la part du planning déjà passée (minutes prévues jusqu'à aujourd'hui inclus) fixe la
// charge « au rythme » ; au-dessus de la charge visée à ce rythme (décision du 03/11/2026 : la cible, pas le haut de la
// plage), le joueur est trop haut pour le moment de la semaine.
// Séances du groupe (player_id nul) et ses séances individuelles. Pas de plan, blessé
// ou pas de type de semaine : null.
export function weekPace(player: Player, total: number, plan: PlanItem[], today: string, wt: Pick<WeekType, 'target_srpe'> | null) {
  // Blessé : il ne suit pas la charge du groupe, son suivi est celui de la réhab (séances, douleur)
  if (!wt?.target_srpe || player.injured) return null
  const mine = plan.filter(s => (s.player_id === null ? !player.injured : s.player_id === player.id))
  const minutes = (s: PlanItem) => s.planned_duration_min ?? s.activity_types?.default_duration_min ?? 0
  const all = mine.reduce((n, s) => n + minutes(s), 0)
  if (!all) return null
  const share = mine.filter(s => s.session_date <= today).reduce((n, s) => n + minutes(s), 0) / all
  const limit = Math.round(wt.target_srpe * share)
  return { share: round(100 * share), limit, over: total > limit, pct: limit > 0 ? round((100 * total) / limit) : null }
}

// ---------- RPE moyen de la semaine (activités avec RPE seulement : vidéo, kiné, récup exclues) ----------

export function rpeMatrix(players: Player[], weekLogs: Log[], weekStart: string) {
  const dates = DAY_NAMES.map((_, i) => addDays(weekStart, i))
  const avg = (logs: Log[]) => {
    const values = logs.map(l => l.rpe).filter((r): r is number => r !== null).map(Number)
    return values.length ? round(mean(values), 1) : null
  }
  const rows = players.map(player => {
    const own = weekLogs.filter(l => l.player_id === player.id)
    return { player, byDay: dates.map(d => avg(own.filter(l => l.session_date === d))), week: avg(own) }
  })
  const fit = weekLogs.filter(l => !players.find(p => p.id === l.player_id)?.injured)
  return { rows, groupByDay: dates.map(d => avg(fit.filter(l => l.session_date === d))), groupWeek: avg(fit) }
}

// ---------- Synthèse collective jour par jour ----------

export function dailySynthesis(weekLogs: Log[], types: ActivityType[], weekStart: string) {
  const pillarOf = new Map(types.map(t => [t.id, t.pillar]))
  return DAY_NAMES.map((day, i) => {
    const date = addDays(weekStart, i)
    const logs = weekLogs.filter(l => l.session_date === date)
    const declarants = new Set(logs.map(l => l.player_id)).size
    const minutes = (pillar?: Pillar) => logs.filter(l => !pillar || pillarOf.get(l.activity_type_id ?? '') === pillar)
      .reduce((s, l) => s + l.duration_min, 0)
    const cumul = logs.reduce((s, l) => s + srpeOf(l), 0)
    const per = (v: number) => (declarants ? v / declarants : 0)
    const avgMinutes = per(minutes())
    return {
      day, date, declarants,
      avgMinutes: round(avgMinutes), rugbyMinutes: round(per(minutes('rugby'))), physiqueMinutes: round(per(minutes('physique'))),
      avgSrpe: round(per(cumul)), cumulSrpe: cumul,
      intensity: avgMinutes ? round(per(cumul) / avgMinutes, 2) : 0, // UA par minute
    }
  })
}

// Répartition moyenne du volume par pilier, comparée aux préconisations du type de semaine
export function pillarSplit(weekLogs: Log[], types: ActivityType[], wt: WeekType | null) {
  const pillarOf = new Map(types.map(t => [t.id, t.pillar]))
  const players = new Set(weekLogs.map(l => l.player_id)).size || 1
  const total = weekLogs.reduce((s, l) => s + l.duration_min, 0)
  const targets: Record<Pillar, number> = {
    physique: wt?.physique_min ?? 0, rugby: wt?.rugby_min ?? 0, accompagnement: wt?.accompagnement_min ?? 0, ppid: wt?.ppid_min ?? 0,
  }
  return (['physique', 'rugby', 'accompagnement', 'ppid'] as Pillar[]).map(pillar => {
    const minutes = weekLogs.filter(l => pillarOf.get(l.activity_type_id ?? '') === pillar).reduce((s, l) => s + l.duration_min, 0)
    const pct = total ? round((100 * minutes) / total, 1) : 0
    const targetPct = wt?.volume_min ? round((100 * targets[pillar]) / wt.volume_min, 1) : 0
    return { pillar, minutes: round(minutes / players), pct, targetPct, gap: round(pct - targetPct, 1) }
  })
}

// ---------- Fiche joueur : détail jour par jour ----------

export function playerDays(playerLogs: Log[], types: ActivityType[], weekStart: string, dayMeans: number[]) {
  const typeOf = new Map(types.map(t => [t.id, t]))
  return DAY_NAMES.map((day, i) => {
    const date = addDays(weekStart, i)
    const logs = playerLogs.filter(l => l.session_date === date)
    const minutes = (pillar: Pillar) => logs.filter(l => typeOf.get(l.activity_type_id ?? '')?.pillar === pillar).reduce((s, l) => s + l.duration_min, 0)
    const rpes = logs.map(l => l.rpe).filter((r): r is number => r !== null).map(Number)
    const srpe = logs.reduce((s, l) => s + srpeOf(l), 0)
    return {
      day, date,
      activities: logs.map(l => `${typeOf.get(l.activity_type_id ?? '')?.name ?? 'Activité'} (${l.duration_min}m)`).join(' + '),
      minutes: logs.reduce((s, l) => s + l.duration_min, 0),
      rugby: minutes('rugby'), physique: minutes('physique'), accompagnement: minutes('accompagnement'),
      avgRpe: rpes.length ? round(mean(rpes), 1) : null,
      srpe, groupMean: dayMeans[i], gap: srpe - dayMeans[i],
    }
  })
}

// ---------- Ratio aigu / chronique (admins) ----------

export type AcwrZone = 'bas' | 'optimal' | 'vigilance' | 'risque'

// Jours d'entraînement du Pôle (décision du 06/11/2026) : lundi, mardi, mercredi, vendredi (getUTCDay)
export const TRAINING_DAYS = [1, 2, 3, 5]
const isTrainingDay = (d: string) => TRAINING_DAYS.includes(new Date(`${d}T00:00:00Z`).getUTCDay())

// Les n derniers jours d'entraînement jusqu'à date incluse, du plus récent au plus ancien
function lastTrainingDays(date: string, n: number) {
  const days: string[] = []
  for (let d = date; days.length < n; d = addDays(d, -1)) if (isTrainingDay(d)) days.push(d)
  return days
}

// Sur les jours d'entraînement seulement (match et activités des autres jours exclus) : aigu = charge des 4 derniers jours
// d'entraînement ; chronique = charge des 16 derniers, ramenée à 4 jours (moyenne de 4 blocs)
export function acwr(playerLogs: Log[], date: string): { acute: number; chronic: number; ratio: number | null; zone: AcwrZone | null } {
  const days = lastTrainingDays(date, 16)
  const sum = (window: string[]) => playerLogs.filter(l => window.includes(l.session_date)).reduce((s, l) => s + srpeOf(l), 0)
  const acute = sum(days.slice(0, 4))
  const chronic = round(sum(days) / 4)
  // Historique plus court que les 16 jours d'entraînement : chronique sous-estimée, ratio gonflé (faux « risque »)
  const firstDay = playerLogs.reduce<string | null>((min, l) => (min === null || l.session_date < min ? l.session_date : min), null)
  if (!chronic || firstDay === null || firstDay > days[15]) return { acute, chronic, ratio: null, zone: null }
  const ratio = round(acute / chronic, 2)
  const zone: AcwrZone = ratio < 0.8 ? 'bas' : ratio <= 1.3 ? 'optimal' : ratio <= 1.5 ? 'vigilance' : 'risque'
  return { acute, chronic, ratio, zone }
}

// ---------- État de forme : alertes et retardataires ----------

export const WELLNESS_ALERT_SCORE = 16 // sur 30

export type WellnessScores = Partial<Record<WellnessKey, number | null>> & { score: number | null; soreness?: number | null }

// Historique importé : une seule question de courbatures, qui vaut pour le haut et le bas du corps
export const itemValue = (w: WellnessScores, key: WellnessKey) =>
  w[key] ?? (key.startsWith('soreness_') ? w.soreness ?? null : null)

export function wellnessAlerts(w: WellnessScores): string[] {
  const reasons: string[] = []
  if (w.score !== null && w.score < WELLNESS_ALERT_SCORE) reasons.push(`Score ${w.score}/30`)
  for (const item of WELLNESS_ITEMS) if (itemValue(w, item.key) === 1) reasons.push(`${item.label} à 1`)
  return reasons
}

// Qui relancer : état de forme du jour non rempli ; RPE manquant la veille alors qu'une activité était prévue
export function latecomers(
  players: Player[], wellnessToday: { player_id: string }[],
  plan: { player_id: string | null; session_date: string; activity_type_id?: string | null; activity_types?: { name: string } | null }[],
  logs: Pick<Log, 'player_id' | 'session_date' | 'activity_type_id' | 'validated_at'>[], today: string,
) {
  const yesterday = addDays(today, -1)
  const filled = new Set(wellnessToday.map(w => w.player_id))
  return players.flatMap(p => {
    const missing: string[] = []
    if (!filled.has(p.id)) missing.push('état de forme du jour')
    // Une activité prévue hier sans déclaration (ou une muscu non validée) suffit : la veille partiellement remplie se relance aussi
    const pendingYesterday = plan.some(s => {
      if (s.session_date !== yesterday || (s.player_id === null ? p.injured : s.player_id !== p.id)) return false
      const l = logs.find(x => x.player_id === p.id && x.session_date === yesterday && x.activity_type_id === s.activity_type_id)
      return !l || (s.player_id !== null && EXERCISE_SESSIONS.includes(s.activity_types?.name ?? '') && !l.validated_at)
    })
    if (pendingYesterday) missing.push('RPE d\'hier')
    return missing.length ? [{ player: p, missing }] : []
  })
}

// RPE non déclarés jour par jour (décision du 06/11/2026 : à remplir à chaque entraînement) : activités prévues avec
// RPE sans déclaration, et séance de musculation non validée. Du plus oublieux au moins oublieux. Un jour où personne du
// groupe n'a rien déclaré (entraînement annulé, app pas encore utilisée) n'est pas compté.
export function missingRpe(players: Player[], plan: PlanItem[], logs: Pick<Log, 'player_id' | 'session_date' | 'activity_type_id' | 'validated_at'>[],
  types: ActivityType[], from: string, to: string) {
  return players.flatMap(p => {
    const days: { date: string; missing: string[] }[] = []
    let planned = 0
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (!logs.some(l => l.session_date === d)) continue
      const mine = plan.filter(s => s.session_date === d && (s.player_id === null ? !p.injured : s.player_id === p.id))
        .map(s => ({ s, t: types.find(t => t.id === s.activity_type_id) })).filter((x): x is { s: PlanItem; t: ActivityType } => !!x.t?.requires_rpe)
      planned += mine.length
      // Séance individuelle à exercices : comptée faite une fois validée ; le reste, dès qu'il est déclaré
      const missing = mine.filter(({ s, t }) => {
        const l = logs.find(x => x.player_id === p.id && x.session_date === d && x.activity_type_id === t.id)
        return !l || (s.player_id !== null && EXERCISE_SESSIONS.includes(t.name) && !l.validated_at)
      }).map(({ t }) => t.name)
      if (missing.length) days.push({ date: d, missing })
    }
    const missed = days.reduce((n, d) => n + d.missing.length, 0)
    return missed ? [{ player: p, missed, planned, days }] : []
  }).sort((a, b) => b.missed - a.missed || b.missed / b.planned - a.missed / a.planned)
}

export const reminderMessage = (p: Player, missing: string[]) =>
  `Salut ${p.first_name}, pense à remplir ${missing.join(' et ')} dans l'app du Pôle. Merci !`

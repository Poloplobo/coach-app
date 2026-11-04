// Calculs du tableau de bord staff, calqués sur les onglets TABLEAU_DE_BORD et SUIVI_INDIVIDUEL du classeur PER.
// Fonctions pures : la vue, l'export Excel et les tests utilisent exactement les mêmes chiffres.
import { addDays } from '../../lib/week'
import { MUSCULATION } from '../rpe/activities'
import { WELLNESS_ITEMS, type WellnessKey } from '../wellness/items'

export type Pillar = 'rugby' | 'physique' | 'accompagnement' | 'ppid'
export type ActivityType = { id: string; name: string; pillar: Pillar; requires_rpe: boolean; default_duration_min?: number | null; max_srpe?: number | null }
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

// ---------- Seuils de charge (0030) ----------

export type Heat = 'warn' | 'bad'
export const OVER_FACTOR = 1.25 // rouge au-delà de 1,25 × le seuil de l'activité

// Une séance au-dessus du seuil de son activité : orange, puis rouge au-delà de 1,25 × le seuil ; pas de seuil : rien
export function overLoad(srpe: number, max: number | null | undefined): Heat | null {
  if (!max || srpe <= max) return null
  return srpe > max * OVER_FACTOR ? 'bad' : 'warn'
}

// Séances d'un joueur au-dessus du seuil de leur activité, la plus chaude d'abord
export function hotSessions(playerLogs: Log[], types: ActivityType[]) {
  return playerLogs.flatMap(l => {
    const type = types.find(t => t.id === l.activity_type_id)
    const heat = overLoad(srpeOf(l), type?.max_srpe)
    return heat && type ? [{ date: l.session_date, name: type.name, srpe: srpeOf(l), max: type.max_srpe!, heat }] : []
  }).sort((a, b) => b.srpe / b.max - a.srpe / a.max)
}

export type PlanItem = {
  player_id: string | null; session_date: string; planned_duration_min?: number | null
  activity_type_id?: string | null; planned_rpe?: number | null
  activity_types?: { default_duration_min?: number | null } | null
}

// Rythme de la semaine en cours : la part du planning déjà passée (minutes prévues jusqu'à aujourd'hui inclus) fixe la
// charge « au rythme » ; au-dessus de la charge visée à ce rythme (décision du 03/11/2026 : la cible, pas le haut de la
// plage), le joueur est trop haut pour le moment de la semaine.
// Séances du groupe (player_id nul) pour les aptes, plus ses séances individuelles. Pas de plan
// ou pas de type de semaine : null.
export function weekPace(player: Player, total: number, plan: PlanItem[], today: string, wt: Pick<WeekType, 'target_srpe'> | null) {
  if (!wt?.target_srpe) return null
  const mine = plan.filter(s => (s.player_id === null ? !player.injured : s.player_id === player.id))
  const minutes = (s: PlanItem) => s.planned_duration_min ?? s.activity_types?.default_duration_min ?? 0
  const all = mine.reduce((n, s) => n + minutes(s), 0)
  if (!all) return null
  const share = mine.filter(s => s.session_date <= today).reduce((n, s) => n + minutes(s), 0) / all
  const limit = Math.round(wt.target_srpe * share)
  return { share: round(100 * share), limit, over: total > limit, pct: limit > 0 ? round((100 * total) / limit) : null }
}

// ---------- RPE visé (0031) ----------

export type TargetRpe = { week_type_code: string; activity_type_id: string; target_rpe: number }

// RPE visé d'une déclaration : celui de la séance du planning s'il est saisi, sinon celui du type de semaine pour l'activité
export function targetRpe(log: Pick<Log, 'player_id' | 'session_date' | 'activity_type_id'>, plan: PlanItem[], weekType: string | null | undefined, targets: TargetRpe[]) {
  const planned = plan.find(s => s.session_date === log.session_date && s.activity_type_id === log.activity_type_id
    && (s.player_id === null || s.player_id === log.player_id) && s.planned_rpe != null)
  if (planned) return Number(planned.planned_rpe)
  const t = targets.find(t => t.week_type_code === weekType && t.activity_type_id === log.activity_type_id)
  return t ? Number(t.target_rpe) : null
}

// Écart au RPE visé : orange à ±2, rouge à ±3 et plus (décision du 04/11/2026)
export function rpeGap(rpe: number | null, target: number | null): { gap: number; heat: Heat | null } | null {
  if (rpe === null || target === null) return null
  const gap = round(Number(rpe) - target, 1)
  return { gap, heat: Math.abs(gap) >= 3 ? 'bad' : Math.abs(gap) >= 2 ? 'warn' : null }
}

// « RPE 6 · visé 4 (+2) »
export const rpeVsTarget = (rpe: number | null, target: number | null) => {
  const g = rpeGap(rpe, target)
  const n = (v: number) => v.toLocaleString('fr-FR')
  return rpe === null ? '' : target === null ? `RPE ${n(Number(rpe))}` : `RPE ${n(Number(rpe))} · visé ${n(target)} (${g!.gap > 0 ? '+' : ''}${n(g!.gap)})`
}

// Charge prévue d'une liste d'activités si les RPE visés sont respectés (sans RPE visé : non comptée)
export const plannedLoad = (items: { minutes: number; rpe: number | null }[]) => Math.round(items.reduce((n, i) => n + (i.rpe ?? 0) * i.minutes, 0))

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

// Aigu = charge des 7 derniers jours ; chronique = moyenne hebdomadaire des 28 derniers jours
export function acwr(playerLogs: Log[], date: string): { acute: number; chronic: number; ratio: number | null; zone: AcwrZone | null } {
  const sum = (days: number) => playerLogs
    .filter(l => l.session_date > addDays(date, -days) && l.session_date <= date).reduce((s, l) => s + srpeOf(l), 0)
  const acute = sum(7)
  const chronic = round(sum(28) / 4)
  // Moins de 28 jours d'historique : la moyenne chronique serait sous-estimée et le ratio gonflé (faux « risque »)
  const firstDay = playerLogs.reduce<string | null>((min, l) => (min === null || l.session_date < min ? l.session_date : min), null)
  if (!chronic || firstDay === null || firstDay > addDays(date, -27)) return { acute, chronic, ratio: null, zone: null }
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
      return !l || (s.activity_types?.name === MUSCULATION && !l.validated_at)
    })
    if (pendingYesterday) missing.push('RPE d\'hier')
    return missing.length ? [{ player: p, missing }] : []
  })
}

export const reminderMessage = (p: Player, missing: string[]) =>
  `Salut ${p.first_name}, pense à remplir ${missing.join(' et ')} dans l'app du Pôle. Merci !`

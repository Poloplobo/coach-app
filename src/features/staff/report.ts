// Contenu des extractions PowerPoint (étape 9). Fonctions pures, testées : mêmes calculs que l'écran (load.ts, muscu.ts).
import { addDays, parisDate } from '../../lib/week'
import { fullName, loadStatus, weekMatrix, type Log, type Player, type Status, type WeekType } from './load'
import { muscuSummary, parseDoneLoad, type StaffMuscuSession } from './muscu'

type Week = { code: string; label: string | null; start_date: string; week_type_code: string; cycle: string | null }
export type CycleTarget = { test: string; value: number; label: string | null; exercise: string | null }

// « 26 oct. »
const shortDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const round = (v: number, digits = 0) => Math.round(v * 10 ** digits) / 10 ** digits
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null)

// Bilan de cycle d'un joueur : semaines choisies à l'export (ex. S7 → S12)
export function cycleReport(input: {
  player: Player; weeks: Week[]; weekTypes: WeekType[]; sessions: StaffMuscuSession[]; logs: Log[]
  muscuTypeId: string | undefined; targets: CycleTarget[]; today?: string
}) {
  const { player, weeks, weekTypes, logs, targets, today = parisDate() } = input
  const sessions = [...input.sessions].sort((a, b) => a.session_date.localeCompare(b.session_date))
  const from = weeks[0]?.start_date ?? ''
  const to = weeks.length ? addDays(weeks.at(-1)!.start_date, 6) : ''
  const sessionRpes = logs.filter(l => l.activity_type_id === input.muscuTypeId && l.rpe !== null).map(l => Number(l.rpe))
  const summary = muscuSummary(sessions, sessionRpes)

  // Charge réalisée max de l'exercice à chaque séance où il apparaît (texte libre lu par parseDoneLoad)
  const series = (exercise: string) => sessions.flatMap(s => {
    const values = s.planned_exercises.filter(e => e.exercises.name.toLowerCase() === exercise.toLowerCase())
      .map(e => parseDoneLoad(e.exercise_feedback[0]?.done_load ?? null)).filter((v): v is number => v !== null && v > 0)
    return values.length ? [{ date: s.session_date, load: Math.max(...values) }] : []
  })

  // Mouvements prioritaires = exercices liés aux objectifs chiffrés du joueur
  const objectives = targets.map(t => {
    const points = t.exercise ? series(t.exercise) : []
    const start = points[0]?.load ?? null
    const end = points.at(-1)?.load ?? null
    const best = points.length ? Math.max(...points.map(p => p.load)) : null
    return {
      ...t, points, start, end, best,
      gainPct: start && end !== null ? round((100 * (end - start)) / start, 1) : null,
      targetPct: best !== null && t.value ? round((100 * best) / t.value) : null,
    }
  })

  // « Plus gros exercices » : les 5 plus lourds réalisés sur le cycle, avec leur RPE moyen
  // Clé sans casse : « Back Squat » et « back squat » sont le même mouvement (nom affiché : le premier rencontré)
  const byExercise = new Map<string, { name: string; best: number; rpes: number[] }>()
  for (const e of sessions.flatMap(s => s.planned_exercises)) {
    const f = e.exercise_feedback[0]
    const load = parseDoneLoad(f?.done_load ?? null) ?? (e.load_unit === 'kg' ? Number(e.load_value) : null)
    if (!load) continue
    const key = e.exercises.name.trim().toLowerCase()
    const cur = byExercise.get(key) ?? { name: e.exercises.name, best: 0, rpes: [] }
    cur.best = Math.max(cur.best, load)
    if (f?.rpe != null) cur.rpes.push(Number(f.rpe))
    byExercise.set(key, cur)
  }
  const heaviest = [...byExercise.values()].sort((a, b) => b.best - a.best).slice(0, 5)
    .map(v => ({ name: v.name, best: v.best, rpe: v.rpes.length ? round(mean(v.rpes)!, 1) : null }))

  // Charge hebdo (sRPE) du joueur vs cible de chaque semaine
  const weekly = weeks.map(w => {
    const wt = weekTypes.find(t => t.code === w.week_type_code) ?? null
    const total = logs.filter(l => l.session_date >= w.start_date && l.session_date <= addDays(w.start_date, 6))
      .reduce((s, l) => s + Number(l.srpe ?? 0), 0)
    // Semaine pas terminée : pas de statut (un mercredi, tout le monde serait en sous-charge), comme dans la vue Semaine
    return { code: w.code, total, target: wt?.target_srpe ?? 0, status: addDays(w.start_date, 6) >= today ? null : loadStatus(total, wt) }
  })

  return {
    title: `Bilan de cycle — ${player.first_name} ${player.last_name}`,
    period: weeks.length ? `${weeks[0].code} → ${weeks.at(-1)!.code} (du ${shortDate(from)} au ${shortDate(to)})` : '',
    cycle: [...new Set(weeks.map(w => w.cycle).filter(Boolean))].join(', '),
    summary, objectives, heaviest, weekly,
  }
}

// Résumé collectif de la semaine (calque du Résumé coach), pour la diapo
export function weekReport(input: { week: Week; wt: WeekType | null; players: Player[]; logs: Log[]; inProgress: boolean }) {
  const { week, wt, players, logs, inProgress } = input
  const m = weekMatrix(players, logs, week.start_date, wt, { inProgress })
  const rows = [...m.rows].sort((a, b) => b.total - a.total)
  const count = (s: Status) => m.rows.filter(r => !r.player.injured && r.status === s).length
  return {
    m,
    players: rows.map(r => ({ name: fullName(r.player), total: r.total, pct: r.pct, status: r.status, injured: r.player.injured })),
    counts: { under: count('sous-charge'), ok: count('conforme'), over: count('surcharge'), injured: m.rows.filter(r => r.player.injured).length },
  }
}

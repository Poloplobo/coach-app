// Contenu des extractions PowerPoint (étape 9). Fonctions pures, testées : mêmes calculs que l'écran (load.ts, muscu.ts).
import { addDays, parisDate } from '../../lib/week'
import { fullName, weekMatrix, type Log, type Player, type Status, type WeekType } from './load'
import { muscuSummary, parseDoneLoad, type StaffMuscuSession } from './muscu'
import { weeklyLoad } from './summary'

type Week = { code: string; label: string | null; start_date: string; week_type_code: string; cycle: string | null }
export type CycleTarget = { test: string; value: number; label: string | null; exercise: string | null }

// « 26 oct. »
const shortDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const round = (v: number, digits = 0) => Math.round(v * 10 ** digits) / 10 ** digits
// Epley, fiable jusqu'à 10 répétitions ; 1 répétition = la charge elle-même
export const estimated1RM = (load: number, reps: number | null) =>
  reps === null || reps < 1 || reps > 10 ? null : reps === 1 ? load : Math.round(load * (1 + reps / 30) * 2) / 2
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

  // Charge réellement réalisée (lue dans le texte libre) ; exclus : non fait, efforts chronométrés (« 30'' »)
  // et poids de corps, où le nombre saisi n'est pas une charge en kg. Charge libre gardée : le joueur y note ses kg.
  const doneLoad = (e: StaffMuscuSession['planned_exercises'][number]) => {
    const f = e.exercise_feedback[0]
    if (!f || f.status === 'non fait' || e.load_unit === 'bw' || /['’]/.test(e.reps ?? '')) return null
    const load = parseDoneLoad(f.done_load)
    return load && load > 0 ? load : null
  }

  // 1RM estimée (Epley) d'une séance : la charge de travail ne se compare pas telle quelle à un objectif 1RM
  const series = (exercise: string) => sessions.flatMap(s => {
    const points = s.planned_exercises.filter(e => e.exercises.name.trim().toLowerCase() === exercise.trim().toLowerCase())
      .flatMap(e => {
        const load = doneLoad(e)
        const reps = /^\d+$/.test(e.reps?.trim() ?? '') ? Number(e.reps) : null
        return load === null ? [] : [{ load, reps, e1rm: estimated1RM(load, reps) }]
      })
    if (!points.length) return []
    const top = points.reduce((a, b) => ((b.e1rm ?? b.load) > (a.e1rm ?? a.load) ? b : a))
    return [{ date: s.session_date, ...top }]
  })

  // Mouvements prioritaires = exercices liés aux objectifs chiffrés du joueur
  const objectives = targets.map(t => {
    const points = t.exercise ? series(t.exercise) : []
    const first = points[0] ?? null
    const last = points.at(-1) ?? null
    const estimates = points.map(p => p.e1rm).filter((v): v is number => v !== null)
    const bestE1rm = estimates.length ? Math.max(...estimates) : null
    return {
      ...t, points, first, last, bestE1rm,
      // Gain et % de l'objectif sur la 1RM estimée (null si les reps ne permettent pas d'estimer)
      gainPct: first?.e1rm && last?.e1rm != null ? round((100 * (last.e1rm - first.e1rm)) / first.e1rm, 1) : null,
      targetPct: bestE1rm !== null && t.value ? round((100 * bestE1rm) / t.value) : null,
    }
  })

  // « Plus gros exercices » : les 5 plus lourds réellement réalisés sur le cycle, avec leur RPE moyen
  // Clé sans casse : « Back Squat » et « back squat » sont le même mouvement (nom affiché : le premier rencontré)
  const byExercise = new Map<string, { name: string; best: number; rpes: number[] }>()
  for (const e of sessions.flatMap(s => s.planned_exercises)) {
    const load = doneLoad(e)
    if (load === null) continue
    const key = e.exercises.name.trim().toLowerCase()
    const cur = byExercise.get(key) ?? { name: e.exercises.name, best: 0, rpes: [] }
    cur.best = Math.max(cur.best, load)
    const rpe = e.exercise_feedback[0]?.rpe
    if (rpe != null) cur.rpes.push(Number(rpe))
    byExercise.set(key, cur)
  }
  const heaviest = [...byExercise.values()].sort((a, b) => b.best - a.best).slice(0, 5)
    .map(v => ({ name: v.name, best: v.best, rpe: v.rpes.length ? round(mean(v.rpes)!, 1) : null }))

  // Charge hebdo (sRPE) du joueur vs cible de chaque semaine : même calcul que les résumés bloc / cycle (summary.ts)
  const weekly = weeklyLoad(weeks, weekTypes, logs, today)
    .map(w => ({ code: w.inProgress || w.future ? `${w.code} (en cours)` : w.code, total: w.total, target: w.target, status: w.status }))

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

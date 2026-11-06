// Suivi d'un joueur blessé (décision du 06/11/2026) : séances de réhab et membres sains faites / prévues, douleur EVA
// (0 à 10) exercice par exercice dans le temps. Fonctions pures, testées.
export type InjurySession = {
  id: string; session_date: string; activity_types: { name: string }
  planned_exercises: { exercises: { name: string } | null; exercise_feedback: { pain: number | null; status: string | null }[] }[]
}

export function injurySummary(sessions: InjurySession[], validatedIds: Set<string>, weekStart: string, today: string) {
  const week = sessions.filter(s => s.session_date >= weekStart && s.session_date <= today)
  // Douleur par exercice, de la plus ancienne à la plus récente mesure
  const byExercise = new Map<string, { date: string; pain: number }[]>()
  for (const s of [...sessions].sort((a, b) => a.session_date.localeCompare(b.session_date))) {
    for (const e of s.planned_exercises) {
      const pain = e.exercise_feedback[0]?.pain
      if (pain == null || !e.exercises) continue
      byExercise.set(e.exercises.name, [...(byExercise.get(e.exercises.name) ?? []), { date: s.session_date, pain }])
    }
  }
  const pain = [...byExercise].map(([name, points]) => ({
    name, points, last: points.at(-1)!.pain, trend: points.length > 1 ? points.at(-1)!.pain - points[0].pain : 0,
  })).sort((a, b) => b.last - a.last)
  return {
    planned: week.length, done: week.filter(s => validatedIds.has(s.id)).length,
    byType: ['Réhabilitation', 'Membres sains'].map(type => {
      const t = week.filter(s => s.activity_types.name === type)
      return { type, planned: t.length, done: t.filter(s => validatedIds.has(s.id)).length }
    }),
    pain,
  }
}

// Rapport de suivi depuis la blessure, semaine par semaine (lundi ISO) : réhab et membres sains faits / prévus,
// cardio et reprise terrain déclarés par le joueur, RPE moyen et douleur moyenne. points : une ligne par séance
// à exercices (date, type, RPE de séance, douleur moyenne), pour une courbe d'évolution.
export type ReportLog = { session_date: string; activity_type_id: string | null; duration_min: number; rpe: number | null; validated_at?: string | null }
const mondayOf = (d: string) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10) }
const mean = (v: number[]) => (v.length ? Math.round((10 * v.reduce((a, b) => a + b, 0)) / v.length) / 10 : null)

export function injuryReport(sessions: InjurySession[], logs: ReportLog[], types: { id: string; name: string }[], from: string, today: string) {
  const name = (id: string | null) => types.find(t => t.id === id)?.name ?? ''
  const past = sessions.filter(s => s.session_date >= from && s.session_date <= today)
  const logOf = (s: InjurySession) => logs.find(l => l.session_date === s.session_date && name(l.activity_type_id) === s.activity_types.name)
  const painOf = (s: InjurySession) => mean(s.planned_exercises.map(e => e.exercise_feedback[0]?.pain).filter((x): x is number => x != null))
  const points = past.map(s => ({ date: s.session_date, type: s.activity_types.name, done: !!logOf(s)?.validated_at,
    rpe: logOf(s)?.validated_at ? logOf(s)!.rpe : null, pain: painOf(s) }))
  const extra = (type: string) => logs.filter(l => name(l.activity_type_id) === type && l.session_date >= from && l.session_date <= today)
  const mondays = [...new Set([...points.map(p => p.date), ...logs.map(l => l.session_date)].filter(d => d >= from && d <= today).map(mondayOf))].sort()
  const weeks = mondays.map(monday => {
    const inWeek = (d: string) => mondayOf(d) === monday
    const pts = points.filter(p => inWeek(p.date))
    const count = (type: string) => ({ planned: pts.filter(p => p.type === type).length, done: pts.filter(p => p.type === type && p.done).length })
    const sum = (type: string) => { const l = extra(type).filter(x => inWeek(x.session_date)); return { n: l.length, min: l.reduce((a, x) => a + x.duration_min, 0) } }
    return {
      monday, rehab: count('Réhabilitation'), healthy: count('Membres sains'), cardio: sum('Cardio (porté / course)'), field: sum('Reprise terrain'),
      rpe: mean(pts.flatMap(p => (p.rpe != null ? [Number(p.rpe)] : []))), pain: mean(pts.flatMap(p => (p.pain != null ? [p.pain] : []))),
    }
  })
  return { weeks, points }
}

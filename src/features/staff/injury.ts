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

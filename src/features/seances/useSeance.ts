import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { EXERCISE_SESSIONS } from '../rpe/activities'
import { addDays } from '../../lib/week'
import type { FeedbackStatus, PastLoad, PlannedExercise, ReferenceMax } from './program'

export type MuscuSession = { id: string; session_date: string; planned_duration_min: number | null; focus: string | null; activity_types: { name: string }; planned_exercises: PlannedExercise[] }

// Séances de musculation du joueur sur la semaine ; la RLS ne renvoie que ses propres retours
export function useWeekProgram(playerId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['program', playerId, from, to],
    queryFn: async (): Promise<MuscuSession[]> => {
      const { data, error } = await supabase.from('planned_sessions')
        .select(`id, session_date, planned_duration_min, focus, activity_types!inner(name),
          planned_exercises(id, exercise_id, position, block_label, sets, reps, load_value, load_unit, tempo, rest, instructions,
            exercises(name), exercise_feedback(rpe, done_load, status, comment, pain))`)
        .eq('player_id', playerId).in('activity_types.name', EXERCISE_SESSIONS)
        .gte('session_date', from).lte('session_date', to).order('session_date')
      if (error) throw error
      return data
    },
  })
}

// Tests en kg liés à un exercice (lien posé par le staff) : base de la charge indicative des %RM
export function useReferenceMaxes(playerId: string) {
  return useQuery({
    queryKey: ['referenceMaxes', playerId],
    queryFn: async (): Promise<ReferenceMax[]> => {
      const { data, error } = await supabase.from('test_results')
        .select('test_date, value, test_definitions!inner(name, unit, exercise_id)')
        .eq('player_id', playerId).eq('test_definitions.unit', 'kg').not('test_definitions.exercise_id', 'is', null)
      if (error) throw error
      return data.map(r => ({ exercise_id: r.test_definitions.exercise_id!, test: r.test_definitions.name, date: r.test_date, value: Number(r.value) }))
    },
  })
}

// Charges réalisées sur les séances des 4 derniers mois avant ce jour (hors « non fait ») : repère « la dernière fois »
export function usePastLoads(playerId: string, before: string) {
  return useQuery({
    queryKey: ['pastLoads', playerId, before],
    queryFn: async (): Promise<PastLoad[]> => {
      const { data, error } = await supabase.from('exercise_feedback')
        .select('done_load, planned_exercises!inner(exercise_id, planned_sessions!inner(session_date))')
        .eq('player_id', playerId).neq('status', 'non fait').not('done_load', 'is', null)
        .lt('planned_exercises.planned_sessions.session_date', before)
        .gte('planned_exercises.planned_sessions.session_date', addDays(before, -120))
      if (error) throw error
      return data.map(r => ({ exercise_id: r.planned_exercises.exercise_id, date: r.planned_exercises.planned_sessions.session_date, done_load: r.done_load! }))
    },
  })
}

export type FeedbackInput = { plannedExerciseId: string; status: FeedbackStatus; doneLoad: string | null; rpe: number | null; comment: string | null; pain?: number | null }

// Modifiable toute la journée tant que la séance n'est pas validée (verrou en base)
export function useSaveFeedback(playerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (f: FeedbackInput) => {
      const { error } = await supabase.from('exercise_feedback').upsert({
        player_id: playerId, planned_exercise_id: f.plannedExerciseId, status: f.status,
        done_load: f.doneLoad, rpe: f.rpe, comment: f.comment, ...(f.pain !== undefined ? { pain: f.pain } : {}),
      }, { onConflict: 'player_id,planned_exercise_id' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['program', playerId] }),
  })
}

// « Séance non faite » : tous les exercices passent en « non fait », sans charge déclarée (les autres champs sont gardés)
// Séance manquée d'un jour passé de la semaine, reprise aujourd'hui (0033 : la base vérifie tout et efface ses retours)
export function useRedoMuscu(playerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc('redo_muscu_session', { p_session: sessionId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program', playerId] })
      queryClient.invalidateQueries({ queryKey: ['sessionLogs', playerId] })
    },
  })
}

export function useMarkNotDone(playerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (plannedExerciseIds: string[]) => {
      const { error } = await supabase.from('exercise_feedback').upsert(
        plannedExerciseIds.map(id => ({ player_id: playerId, planned_exercise_id: id, status: 'non fait' })),
        { onConflict: 'player_id,planned_exercise_id' },
      )
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['program', playerId] }),
  })
}

// Valider = déclarer le RPE de séance rattaché à la séance planifiée : la base verrouille alors les retours.
// Les exercices restés sans retour sont d'abord notés « non fait » (après le verrou, ce ne serait plus possible).
export function useValidateSession(playerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      date: string; plannedSessionId: string; activityTypeId: string; durationMin: number; rpe: number; unansweredExerciseIds: string[]
    }) => {
      if (v.unansweredExerciseIds.length) {
        const { error } = await supabase.from('exercise_feedback').upsert(
          v.unansweredExerciseIds.map(id => ({ player_id: playerId, planned_exercise_id: id, status: 'non fait' })),
          { onConflict: 'player_id,planned_exercise_id' },
        )
        if (error) throw error
      }
      const { error } = await supabase.from('session_logs').upsert({
        player_id: playerId, session_date: v.date, activity_type_id: v.activityTypeId, planned_session_id: v.plannedSessionId,
        duration_min: v.durationMin, rpe: v.rpe, validated_at: new Date().toISOString(),
      }, { onConflict: 'player_id,session_date,activity_type_id' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program', playerId] })
      queryClient.invalidateQueries({ queryKey: ['sessionLogs', playerId] })
    },
  })
}

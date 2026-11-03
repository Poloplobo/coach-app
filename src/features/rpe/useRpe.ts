import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { addDays } from '../../lib/week'
import type { PlannedRow } from './activities'

export function useAvailability(playerId: string) {
  return useQuery({
    queryKey: ['availability', playerId],
    queryFn: async () => {
      const { data, error } = await supabase.from('player_availability').select('status').eq('player_id', playerId).maybeSingle()
      if (error) throw error
      return data?.status ?? 'apte'
    },
  })
}

// Séances planifiées visibles par le joueur : la RLS ne renvoie que les siennes et celles de ses groupes
export function usePlanRange(playerId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['planned', playerId, from, to],
    queryFn: async (): Promise<(PlannedRow & { session_date: string })[]> => {
      const { data, error } = await supabase.from('planned_sessions')
        .select('id, session_date, player_id, planned_duration_min, activity_types!inner(id, name, requires_rpe, default_duration_min)')
        .gte('session_date', from).lte('session_date', to).order('session_date')
      if (error) throw error
      return data
    },
  })
}

export function useActivityTypes() {
  return useQuery({
    queryKey: ['activityTypes'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('activity_types')
        .select('id, name, requires_rpe, default_duration_min').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useLogsRange(playerId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['sessionLogs', playerId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from('session_logs')
        .select('id, session_date, activity_type_id, planned_session_id, duration_min, rpe, srpe, validated_at')
        .eq('player_id', playerId).gte('session_date', from).lte('session_date', to)
      if (error) throw error
      return data
    },
  })
}

// Relance du staff pour hier : le joueur peut alors déclarer sa veille (RLS can_log_day) ; null sans relance
export function useCatchUpDay(playerId: string, today: string) {
  const yesterday = addDays(today, -1)
  return useQuery({
    queryKey: ['reminder', playerId, yesterday],
    queryFn: async () => {
      const { data, error } = await supabase.from('rpe_reminders').select('missing_date').eq('player_id', playerId).eq('missing_date', yesterday).maybeSingle()
      if (error) throw error
      return data ? yesterday : null
    },
  })
}

export type LogInput = {
  date: string; activityTypeId: string; plannedSessionId: string | null; durationMin: number; rpe: number | null
}

// Une ligne par activité et par jour : redéclarer le même jour la modifie (la base refuse un jour passé)
export function useSaveLog(playerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (l: LogInput) => {
      const { error } = await supabase.from('session_logs').upsert({
        player_id: playerId, session_date: l.date, activity_type_id: l.activityTypeId,
        planned_session_id: l.plannedSessionId, duration_min: l.durationMin, rpe: l.rpe,
      }, { onConflict: 'player_id,session_date,activity_type_id' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessionLogs', playerId] }),
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { addDays } from '../../lib/week'
import type { PlannedRow, SkipReason } from './activities'

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
        .select('id, session_date, activity_type_id, planned_session_id, duration_min, rpe, srpe, validated_at, source')
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

// Activités prévues que le joueur dit ne pas avoir faites (0041) : ce n'est pas un oubli de RPE
export function useSkipsRange(playerId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['sessionSkips', playerId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from('session_skips').select('activity_type_id, session_date, reason, note')
        .eq('player_id', playerId).gte('session_date', from).lte('session_date', to)
      if (error) throw error
      return data
    },
  })
}

export function useSaveSkip(playerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (k: { date: string; activityTypeId: string; reason: SkipReason; note: string | null }) => {
      const { error } = await supabase.from('session_skips').insert({
        player_id: playerId, session_date: k.date, activity_type_id: k.activityTypeId, reason: k.reason, note: k.note,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessionSkips', playerId] }),
  })
}

export function useDeleteSkip(playerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (k: { date: string; activityTypeId: string }) => {
      const { data, error } = await supabase.from('session_skips').delete()
        .eq('player_id', playerId).eq('session_date', k.date).eq('activity_type_id', k.activityTypeId).select('id')
      if (error) throw error
      if (!data.length) throw new Error('jour plus modifiable') // RLS : hors fenêtre de saisie, rien n'est supprimé
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessionSkips', playerId] }),
  })
}

// Type de la semaine (DEV / COMP / REG) et sa plage de charge ; null si la semaine n'est pas au calendrier
// shortcut: un seul groupe (PER) : la semaine trouvée à cette date ; filtrer par groupe s'il y en a plusieurs
export function useWeekTarget(monday: string) {
  return useQuery({
    queryKey: ['weekTarget', monday],
    queryFn: async () => {
      const { data, error } = await supabase.from('season_weeks')
        .select('code, week_types(code, name, srpe_min, srpe_max, target_srpe)').eq('start_date', monday).limit(1).maybeSingle()
      if (error) throw error
      return data?.week_types ? { week: data.code, ...data.week_types } : null
    },
    staleTime: Infinity,
  })
}

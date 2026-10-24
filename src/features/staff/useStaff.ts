import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useProfile, useUserId } from '../auth/useAuth'
import type { WellnessItems } from '../wellness/items'
import type { ActivityType, Log, Player, WeekType } from './load'

// Le staff lit tout (RLS) ; un joueur qui appellerait ces requêtes ne recevrait que ses propres lignes.

const query = <T,>(key: unknown[], fn: () => Promise<T>, staleTime = 30_000) => ({ queryKey: key, queryFn: fn, staleTime })
const check = <T,>({ data, error }: { data: T; error: unknown }): NonNullable<T> => {
  if (error) throw error
  return (data ?? []) as NonNullable<T> // listes uniquement ; maybeSingle() est traité à part
}

// Affichage seulement (ratio aigu/chronique, bouton blessé / apte) : la base refuse de toute façon un coach
export const useIsAdmin = () => useProfile(useUserId()).data?.role === 'admin'

export function useRoster() {
  return useQuery(query(['staff', 'roster'], async (): Promise<Player[]> => {
    const profiles = check(await supabase.from('profiles').select('id, first_name, last_name, position').eq('role', 'player').order('last_name'))
    const injured = new Set(check(await supabase.from('player_availability').select('player_id').eq('status', 'blessé')).map(a => a.player_id))
    return profiles.map(p => ({ ...p, injured: injured.has(p.id) }))
  }))
}

export function useReference() {
  return useQuery(query(['staff', 'reference'], async () => ({
    types: check(await supabase.from('activity_types').select('id, name, pillar, requires_rpe')) as ActivityType[],
    weekTypes: check(await supabase.from('week_types')
      .select('code, name, target_srpe, srpe_min, srpe_max, volume_min, physique_min, rugby_min, accompagnement_min, ppid_min')) as WeekType[],
    weeks: check(await supabase.from('season_weeks').select('code, label, start_date, week_type_code, cycle, phase_note').order('start_date')),
  }), Infinity))
}

export function useAllLogs(from: string, to: string) {
  return useQuery({
    ...query(['staff', 'logs', from, to], async (): Promise<Log[]> => check(await supabase.from('session_logs')
      .select('player_id, session_date, activity_type_id, duration_min, rpe, srpe, source, created_at')
      .gte('session_date', from).lte('session_date', to))),
    enabled: !!from && !!to, // pas de semaine choisie : rien à charger
  })
}

export function useAllWellness(from: string, to: string) {
  return useQuery(query(['staff', 'wellness', from, to], async () => check(await supabase.from('wellness_entries')
    .select('player_id, entry_date, sleep_quality, fatigue, soreness, soreness_upper, soreness_lower, stress, mood, score')
    .gte('entry_date', from).lte('entry_date', to))))
}

export function useAllPlan(from: string, to: string) {
  return useQuery(query(['staff', 'plan', from, to], async () => check(await supabase.from('planned_sessions')
    .select('player_id, session_date').gte('session_date', from).lte('session_date', to))))
}

export function useAvailabilityDetail(playerId: string) {
  return useQuery(query(['staff', 'availability', playerId], async () => {
    const { data, error } = await supabase.from('player_availability').select('status, since, note').eq('player_id', playerId).maybeSingle()
    if (error) throw error
    return data // null : jamais déclaré blessé, donc apte
  }))
}

const invalidateStaff = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ queryKey: ['staff'] })

// Admins seulement (RLS) : un coach recevrait un refus
export function useSetAvailability() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { playerId: string; status: 'apte' | 'blessé'; since: string; note: string | null }) => {
      check(await supabase.from('player_availability')
        .upsert({ player_id: a.playerId, status: a.status, since: a.since, note: a.note }, { onConflict: 'player_id' }).select())
    },
    onSuccess: () => invalidateStaff(qc),
  })
}

// Correction d'un oubli ou d'une erreur par le staff, marquée « saisi par le staff »
export function useStaffSaveLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (l: { playerId: string; date: string; activityTypeId: string; durationMin: number; rpe: number | null }) => {
      check(await supabase.from('session_logs').upsert({
        player_id: l.playerId, session_date: l.date, activity_type_id: l.activityTypeId,
        duration_min: l.durationMin, rpe: l.rpe, source: 'staff',
      }, { onConflict: 'player_id,session_date,activity_type_id' }).select())
    },
    onSuccess: () => invalidateStaff(qc),
  })
}

export function useStaffSaveWellness() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (w: { playerId: string; date: string; items: WellnessItems }) => {
      check(await supabase.from('wellness_entries')
        .upsert({ player_id: w.playerId, entry_date: w.date, ...w.items }, { onConflict: 'player_id,entry_date' }).select())
    },
    onSuccess: () => invalidateStaff(qc),
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAll } from '../../lib/fetchAll'
import { supabase } from '../../lib/supabaseClient'
import { useProfile, useUserId } from '../auth/useAuth'
import type { WellnessItems } from '../wellness/items'
import type { ActivityType, Log, Player, TargetRpe, WeekType } from './load'
import type { InjuryRecord } from './medical'
import type { StaffMuscuSession } from './muscu'
import { EXERCISE_SESSIONS, MUSCULATION } from '../rpe/activities'

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
    const profiles = check(await supabase.from('profiles').select('id, first_name, last_name, position').eq('role', 'player').eq('is_test', false).order('last_name'))
    const injured = new Set(check(await supabase.from('player_availability').select('player_id').eq('status', 'blessé')).map(a => a.player_id))
    return profiles.map(p => ({ ...p, injured: injured.has(p.id) }))
  }))
}

export function useReference() {
  return useQuery(query(['staff', 'reference'], async () => ({
    types: check(await supabase.from('activity_types').select('id, name, pillar, requires_rpe, default_duration_min').order('name')) as ActivityType[],
    weekTypes: check(await supabase.from('week_types')
      .select('code, name, target_srpe, srpe_min, srpe_max, volume_min, physique_min, rugby_min, accompagnement_min, ppid_min')) as WeekType[],
    weeks: check(await supabase.from('season_weeks').select('code, label, start_date, week_type_code, cycle, phase_note').order('start_date')),
  }), Infinity))
}

// playerId : une seule personne (fiche joueur sur la saison) ; sinon tout l'effectif (à garder sur une courte période)
export function useAllLogs(from: string, to: string, playerId?: string) {
  return useQuery({
    ...query(['staff', 'logs', from, to, playerId ?? 'all'], (): Promise<Log[]> => fetchAll((a, b) => {
      // Joueur de test (0038) exclu : ses déclarations ne comptent dans aucun chiffre du staff
      let q = supabase.from('session_logs').select('player_id, session_date, activity_type_id, duration_min, rpe, srpe, source, created_at, validated_at, profiles!inner(is_test)').eq('profiles.is_test', false)
        .gte('session_date', from).lte('session_date', to)
      if (playerId) q = q.eq('player_id', playerId)
      return q.order('id').range(a, b)
    })),
    enabled: !!from && !!to, // pas de semaine choisie : rien à charger
  })
}

export function useAllWellness(from: string, to: string, playerId?: string) {
  return useQuery({ enabled: !!from && !!to, ...query(['staff', 'wellness', from, to, playerId ?? 'all'], () => fetchAll((a, b) => {
    let q = supabase.from('wellness_entries')
      .select('player_id, entry_date, sleep_quality, fatigue, soreness, soreness_upper, soreness_lower, stress, mood, score, source, profiles!inner(is_test)').eq('profiles.is_test', false)
      .gte('entry_date', from).lte('entry_date', to)
    if (playerId) q = q.eq('player_id', playerId)
    return q.order('id').range(a, b)
  })) })
}

export function useAllPlan(from: string, to: string) {
  return useQuery({
    ...query(['staff', 'plan', from, to], async () => check(await supabase.from('planned_sessions')
      .select('player_id, session_date, activity_type_id, planned_duration_min, planned_rpe, planned_rpe_max, activity_types(name, default_duration_min)').gte('session_date', from).lte('session_date', to))),
    enabled: !!from && !!to, // pas de semaine choisie : rien à charger
  })
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

// Joueurs qui ont activé le rappel du matin sur au moins un téléphone (0026 : jamais les abonnements eux-mêmes)
export function usePushEnabled() {
  return useQuery(query(['staff', 'push'], async () => new Set(check(await supabase.rpc('push_enabled_players')) as string[])))
}

// RPE visés par type de semaine et activité (0031), lisibles par tout connecté
export function useTargetRpes() {
  return useQuery(query(['staff', 'target-rpe'], async () => check(await supabase.from('week_type_rpe').select('week_type_code, activity_type_id, rpe_min, rpe_max')) as TargetRpe[]))
}

// Relances du jour donné (joueurs autorisés à rattraper ce jour-là, 0025)
export function useReminders(date: string) {
  return useQuery(query(['staff', 'reminders', date], async () => (check(await supabase.from('rpe_reminders')
    .select('player_id').eq('missing_date', date)) as { player_id: string }[]).map(r => r.player_id)))
}

// « Relancer » : le joueur voit un bandeau et peut déclarer ce jour-là (hier) jusqu'à minuit
export function useRemind() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (r: { playerId: string; date: string }) => {
      check(await supabase.from('rpe_reminders').upsert({ player_id: r.playerId, missing_date: r.date }, { onConflict: 'player_id,missing_date' }).select('player_id'))
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
        .upsert({ player_id: w.playerId, entry_date: w.date, ...w.items, source: 'staff' }, { onConflict: 'player_id,entry_date' }).select())
    },
    onSuccess: () => invalidateStaff(qc),
  })
}

// Fiches blessure (0036) : toutes, pour le suivi en cours et l'épidémiologie ; étapes des plans de retour
export function useInjuryRecords() {
  return useQuery(query(['staff', 'injury-records'], async () => (check(await supabase.from('injuries')
    .select('id, player_id, occurred_on, ended_on, location, tissue, mechanism, onset, activity, recurrence, diagnosis, notes, alerts')
    .order('occurred_on', { ascending: false })) as unknown as (InjuryRecord & { diagnosis: string | null; notes: string | null })[])))
}
export function useInjurySteps() {
  return useQuery(query(['staff', 'injury-steps'], async () => check(await supabase.from('injury_steps')
    .select('id, injury_id, player_id, position, title, criteria, planned_days, validated_on, phase, phase_days, objectives, kine_actions, prepa_actions, comment, is_test, in_progress').order('position'))))
}
export function useSaveInjury() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<{ occurred_on: string; location: string | null; tissue: string | null; mechanism: string | null;
      onset: string | null; activity: string | null; recurrence: boolean; diagnosis: string | null; notes: string | null }>) => {
      check(await supabase.from('injuries').update(fields).eq('id', id).select('id'))
    },
    onSuccess: () => invalidateStaff(qc),
  })
}
// Étape du plan de retour : ajout, modification, validation (date du jour) ou annulation, suppression
export function useSaveStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (s: { id?: string; injury_id: string; player_id: string; position: number; title: string; criteria: string | null; planned_days: number; validated_on?: string | null }) => {
      if (s.id) check(await supabase.from('injury_steps').update({ title: s.title, criteria: s.criteria, planned_days: s.planned_days, position: s.position,
        ...(s.validated_on !== undefined ? { validated_on: s.validated_on } : {}) }).eq('id', s.id).select('id'))
      else check(await supabase.from('injury_steps').insert({ injury_id: s.injury_id, player_id: s.player_id, position: s.position, title: s.title, criteria: s.criteria, planned_days: s.planned_days }).select('id'))
    },
    onSuccess: () => invalidateStaff(qc),
  })
}
export function useDeleteStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { check(await supabase.from('injury_steps').delete().eq('id', id).select('id')) },
    onSuccess: () => invalidateStaff(qc),
  })
}

// Joueurs déclarés blessés, depuis quand et la note de l'admin (onglet Médical)
export function useInjuries() {
  return useQuery(query(['staff', 'injuries'], async () => check(await supabase.from('player_availability')
    .select('player_id, since, note').eq('status', 'blessé'))))
}

// Séances à exercices des joueurs blessés (onglet Médical) : exercices, statut, RPE, charge et douleur EVA
export function useMedicalSessions(playerIds: string[], from: string, to: string) {
  return useQuery({
    enabled: playerIds.length > 0 && !!from,
    ...query(['staff', 'medical', playerIds.join(','), from, to], async () => check(await supabase.from('planned_sessions')
      .select(`id, session_date, player_id, activity_type_id, activity_types!inner(name),
        planned_exercises(id, position, block_label, sets, reps, exercises(name), exercise_feedback(status, rpe, pain, done_load))`)
      .in('player_id', playerIds).in('activity_types.name', EXERCISE_SESSIONS)
      .gte('session_date', from).lte('session_date', to).order('session_date'))),
  })
}

// Séances de réhab et membres sains d'un joueur blessé, avec la douleur EVA de chaque exercice (0034)
export function useInjurySessions(playerId: string | undefined, from: string, to: string) {
  return useQuery({
    enabled: !!playerId && !!from,
    ...query(['staff', 'injury', playerId, from, to], async () => check(await supabase.from('planned_sessions')
      .select('id, session_date, activity_type_id, activity_types!inner(name), planned_exercises(exercises(name), exercise_feedback(pain, status))')
      .eq('player_id', playerId!).in('activity_types.name', ['Réhabilitation', 'Membres sains'])
      .gte('session_date', from).lte('session_date', to).order('session_date'))),
  })
}

// Séances de musculation individuelles (avec exercices et retours) ; playerId : un seul joueur (progression sur la saison)
export function useStaffMuscu(from: string, to: string, playerId?: string) {
  return useQuery({
    enabled: !!from && !!to,
    ...query(['staff', 'muscu', from, to, playerId ?? 'all'], (): Promise<StaffMuscuSession[]> => fetchAll((a, b) => {
      let q = supabase.from('planned_sessions')
        .select(`id, session_date, player_id, activity_types!inner(name),
          planned_exercises(id, position, block_label, sets, reps, load_value, load_unit, tempo, rest, instructions,
            exercises(name), exercise_feedback(player_id, rpe, done_load, status, comment))`)
        .eq('activity_types.name', MUSCULATION).not('player_id', 'is', null)
        .gte('session_date', from).lte('session_date', to)
      if (playerId) q = q.eq('player_id', playerId)
      return q.order('id').range(a, b)
    })),
  })
}

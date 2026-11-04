import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabaseClient'
import type { Json } from '../../../lib/database.types'
import { MUSCULATION } from '../../rpe/activities'
import type { RpeRange } from '../load'
import type { StaffMuscuSession } from '../muscu'
import type { ImportExercise } from './importProgram'

// Écritures réservées au staff par la RLS ; après chaque modification, tout l'espace staff se recharge (['staff'])

const check = <T,>({ data, error }: { data: T; error: unknown }): T => { if (error) throw error; return data }
// Listes : jamais null une fois la requête réussie
const rows = <T,>(r: { data: T[] | null; error: unknown }): T[] => check(r) ?? []

const useStaffMutation = <V, R>(fn: (v: V) => Promise<R>) => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }) })
}

// shortcut: un seul groupe (PER) pour l'instant ; ajouter un choix de groupe le jour où il y en aura plusieurs
export function useGroup() {
  return useQuery({
    queryKey: ['staff', 'group'], staleTime: Infinity,
    queryFn: async () => {
      const [group] = rows(await supabase.from('groups').select('id, name, season').order('name').limit(1))
      if (!group) throw new Error('aucun groupe')
      return group
    },
  })
}

export type WeekForm = {
  code: string; label: string; start_date: string; week_type_code: string; cycle: string; phase_note: string; is_off: boolean
}

export function useWeeksFull() {
  return useQuery({
    queryKey: ['staff', 'weeks-full'],
    queryFn: async () => rows(await supabase.from('season_weeks')
      .select('code, label, start_date, week_type_code, cycle, phase_note, is_off').order('start_date')),
  })
}

export function useSaveWeek() {
  return useStaffMutation(async ({ groupId, week, previousCode }: { groupId: string; week: WeekForm; previousCode?: string }) => {
    const row = { group_id: groupId, ...week, label: week.label || null, cycle: week.cycle || null, phase_note: week.phase_note || null }
    if (previousCode) check(await supabase.from('season_weeks').update(row).match({ group_id: groupId, code: previousCode }).select())
    else check(await supabase.from('season_weeks').insert(row).select())
  })
}

// Semaine passée en OFF : plus d'entraînement collectif, ses séances de groupe sont retirées (RPE déjà saisis conservés)
export function useClearGroupWeek() {
  return useStaffMutation(async ({ groupId, from, to }: { groupId: string; from: string; to: string }) => {
    check(await supabase.from('planned_sessions').delete().eq('group_id', groupId).gte('session_date', from).lte('session_date', to).select())
  })
}

export function useGroupPlan(groupId: string | undefined, from: string, to: string) {
  return useQuery({
    enabled: !!groupId && !!from,
    queryKey: ['staff', 'group-plan', groupId, from, to],
    queryFn: async () => rows(await supabase.from('planned_sessions')
      .select('id, session_date, planned_duration_min, planned_rpe, planned_rpe_max, activity_type_id, activity_types(name)')
      .eq('group_id', groupId!).gte('session_date', from).lte('session_date', to).order('session_date')),
  })
}

export function useAddGroupActivity() {
  return useStaffMutation(async (a: { groupId: string; date: string; activityTypeId: string; name: string; minutes: number }) => {
    check(await supabase.from('planned_sessions').insert({
      group_id: a.groupId, session_date: a.date, activity_type_id: a.activityTypeId, title: a.name, planned_duration_min: a.minutes,
    }).select())
  })
}

export function useSetDuration() {
  return useStaffMutation(async ({ id, minutes }: { id: string; minutes: number }) => {
    check(await supabase.from('planned_sessions').update({ planned_duration_min: minutes }).eq('id', id).select())
  })
}

// Fourchette de RPE visé d'une séance du planning ; vide : celle du type de semaine s'applique
export function useSetPlannedRpe() {
  return useStaffMutation(async ({ id, range }: { id: string; range: RpeRange | null }) => {
    check(await supabase.from('planned_sessions').update({ planned_rpe: range?.min ?? null, planned_rpe_max: range?.max ?? null }).eq('id', id).select())
  })
}

// RPE visé par type de semaine et activité (0031) ; vide : plus de RPE visé pour cette activité dans ce type de semaine
export function useSaveTargetRpe() {
  return useStaffMutation(async ({ weekType, activityTypeId, range }: { weekType: string; activityTypeId: string; range: RpeRange | null }) => {
    const key = { week_type_code: weekType, activity_type_id: activityTypeId }
    if (range === null) check(await supabase.from('week_type_rpe').delete().match(key).select())
    else check(await supabase.from('week_type_rpe').upsert({ ...key, rpe_min: range.min, rpe_max: range.max }).select())
  })
}

// Les RPE déjà déclarés pour cette séance restent (lien remis à vide par la base)
export function useRemovePlanned() {
  return useStaffMutation(async (id: string) => { check(await supabase.from('planned_sessions').delete().eq('id', id).select()) })
}

// Séance de musculation d'un joueur pour un jour (une seule par jour)
export function useMuscuSession(playerId: string, date: string) {
  return useQuery({
    enabled: !!playerId && !!date,
    queryKey: ['staff', 'muscu-session', playerId, date],
    queryFn: async (): Promise<(StaffMuscuSession & { planned_exercises: (StaffMuscuSession["planned_exercises"][number] & { exercise_id: string })[] }) | null> => check(await supabase.from('planned_sessions')
      .select(`id, session_date, player_id, activity_types!inner(name),
        planned_exercises(id, exercise_id, position, block_label, sets, reps, load_value, load_unit, tempo, rest, instructions,
          exercises(name), exercise_feedback(player_id, rpe, done_load, status, comment))`)
      .eq('player_id', playerId).eq('session_date', date).eq('activity_types.name', MUSCULATION).maybeSingle()),
  })
}

export function useCreateMuscuSession() {
  return useStaffMutation(async ({ playerId, date, activityTypeId }: { playerId: string; date: string; activityTypeId: string }) => {
    check(await supabase.from('planned_sessions').insert({
      player_id: playerId, session_date: date, activity_type_id: activityTypeId, title: MUSCULATION, planned_duration_min: 60,
    }).select())
  })
}

export type ExerciseRowInput = {
  id?: string; exercise_id: string; block_label: string; sets: number | null; reps: string
  load_value: number | null; load_unit: string; tempo: string; rest: string; instructions: string
}

// Ajouts, modifications, ordre et suppressions en une seule transaction (fonction SQL save_muscu_exercises)
export function useSaveMuscuExercises() {
  return useStaffMutation(async ({ sessionId, rows }: { sessionId: string; rows: ExerciseRowInput[] }) => {
    check(await supabase.rpc('save_muscu_exercises', { p_session: sessionId, p_exercises: rows }))
  })
}

export function useExerciseLibrary() {
  return useQuery({
    queryKey: ['staff', 'exercises'],
    queryFn: async () => rows(await supabase.from('exercises').select('id, name').order('name')),
  })
}

export function useCreateExercise() {
  return useStaffMutation(async (name: string) =>
    check(await supabase.from('exercises').insert({ name: name.trim() }).select('id, name').single()))
}

export function useTestDefinitions() {
  return useQuery({
    queryKey: ['staff', 'test-definitions'], staleTime: Infinity,
    queryFn: async () => rows(await supabase.from('test_definitions').select('id, name, unit, higher_is_better').order('name')),
  })
}

export function useSaveTestResult() {
  return useStaffMutation(async (t: { playerId: string; testId: string; date: string; period: string | null; value: number }) => {
    check(await supabase.from('test_results').upsert({
      player_id: t.playerId, test_id: t.testId, test_date: t.date, period: t.period, value: t.value,
    }, { onConflict: 'player_id,test_id,test_date' }).select())
  })
}

export function useSaveTarget() {
  return useStaffMutation(async (t: { playerId: string; season: string; testId: string; value: number; label: string | null }) => {
    check(await supabase.from('player_targets').upsert({
      player_id: t.playerId, season: t.season, test_id: t.testId, target_value: t.value, label: t.label,
    }, { onConflict: 'player_id,season,test_id' }).select())
  })
}

// Copie une semaine sur une suivante en une transaction (fonction SQL duplicate_week) ; loads : charges recalculées
export function useDuplicateWeek() {
  return useStaffMutation(async ({ groupId, from, to, loads, groupPlan }: { groupId: string; from: string; to: string; loads: Record<string, number>; groupPlan: boolean }) =>
    check(await supabase.rpc('duplicate_week', { p_group: groupId, p_from: from, p_to: to, p_loads: loads, p_group_plan: groupPlan })) as { group: number; individual: number; skipped: number })
}

// Joueurs avec leur nom d'import (« NOM Prénom ») : rapprochement de la fiche musculation importée
export function useImportPlayers() {
  return useQuery({
    queryKey: ['staff', 'import-players'],
    queryFn: async () => rows(await supabase.from('profiles').select('id, first_name, last_name, import_name').eq('role', 'player')),
  })
}

export type ImportResult = { created: number; replaced: number; kept: number; past: number; targets: number }

// Séances + objectifs d'une fiche, en une transaction (fonction SQL import_muscu_program)
export function useImportProgram() {
  return useStaffMutation(async (v: {
    playerId: string; season: string
    sessions: { date: string; exercises: ImportExercise[] }[]; targets: { test_id: string; value: number; label: string | null }[]
  }) =>
    check(await supabase.rpc('import_muscu_program', {
      p_player: v.playerId, p_season: v.season, p_sessions: v.sessions as unknown as Json, p_targets: v.targets as unknown as Json,
    })) as ImportResult)
}

// Supprimer une séance de musculation à venir sans retour du joueur (fonction SQL delete_muscu_session, contrôles en base)
export function useDeleteMuscuSession() {
  return useStaffMutation(async (sessionId: string) => { check(await supabase.rpc('delete_muscu_session', { p_session: sessionId })) })
}

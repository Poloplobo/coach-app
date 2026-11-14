import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

// Suivi individuel (étape 14) : drapeau, modules, demandes d'entretien, inscriptions, objectifs.
// La RLS fait foi : drapeau fermé, ces requêtes ne renvoient rien ; un joueur ne lit que ses lignes, côté staff admin seul.

export const CONSENT_VERSION = '2026-11' // à changer si le texte de consentement change

const rows = <T,>({ data, error }: { data: T[] | null; error: unknown }): T[] => {
  if (error) throw error
  return data ?? []
}
const done = ({ error }: { error: unknown }) => { if (error) throw error }

export type Slot = string // date et heure ISO
export const STATUS_LABEL: Record<string, string> = {
  en_attente: 'en attente', confirme: 'confirmé', autre_creneau: 'autre créneau proposé', refuse: 'refusé', realise: 'réalisé', annule: 'annulé',
}
export const GOAL_LABEL: Record<string, string> = {
  propose: 'à valider par le staff', en_cours: 'en cours', atteint: 'atteint', non_atteint: 'non atteint', abandonne: 'abandonné',
}
export const OPEN_REQUEST = ['en_attente', 'confirme', 'autre_creneau']

// playerId absent : tout (admin) ; sinon les lignes d'un joueur
function scoped<T extends { eq: (c: string, v: string) => T }>(q: T, playerId?: string) { return playerId ? q.eq('player_id', playerId) : q }

export function useModules() {
  return useQuery({ queryKey: ['follow', 'modules'], staleTime: Infinity,
    queryFn: async () => rows(await supabase.from('follow_modules').select('code, label').eq('active', true).order('position')) })
}
export function useRequests(playerId?: string, enabled = true) {
  return useQuery({ enabled, queryKey: ['follow', 'requests', playerId ?? 'all'],
    queryFn: async () => rows(await scoped(supabase.from('follow_requests')
      .select('id, player_id, module_code, slots, comment, status, confirmed_slot, proposed_slot, created_at'), playerId).order('created_at', { ascending: false })) })
}
export function useEnrollments(playerId?: string) {
  return useQuery({ queryKey: ['follow', 'enrollments', playerId ?? 'all'],
    queryFn: async () => rows(await scoped(supabase.from('follow_enrollments')
      .select('id, player_id, module_code, status, activated_at, consented_at, ended_at'), playerId).order('activated_at')) })
}
export function useGoals(playerId?: string) {
  return useQuery({ queryKey: ['follow', 'goals', playerId ?? 'all'],
    queryFn: async () => rows(await scoped(supabase.from('follow_goals')
      .select('id, enrollment_id, player_id, central, means, target_label, target_value, baseline, unit, due_on, status, created_at, validated_at'), playerId)
      .order('created_at', { ascending: false })) })
}
export type Request = NonNullable<ReturnType<typeof useRequests>['data']>[number]
export type Enrollment = NonNullable<ReturnType<typeof useEnrollments>['data']>[number]
export type Goal = NonNullable<ReturnType<typeof useGoals>['data']>[number]
export type GoalInput = { central: string; means: string[]; target_label: string; due_on: string }

function useFollowMutation<V>(fn: (v: V) => Promise<void>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['follow'] }) })
}

// ---------- Joueur ----------
export const useAskInterview = (playerId: string) => useFollowMutation(async (v: { module: string; slots: Slot[]; comment: string }) =>
  done(await supabase.from('follow_requests').insert({ player_id: playerId, module_code: v.module, slots: v.slots, comment: v.comment.trim() || null })))
export const useAnswerRequest = () => useFollowMutation(async (v: { id: string; accept: boolean }) =>
  done(await supabase.rpc('answer_follow_request', { p_request: v.id, p_accept: v.accept })))
export const useConsent = () => useFollowMutation(async (module: string) =>
  done(await supabase.rpc('accept_follow_consent', { p_module: module, p_version: CONSENT_VERSION })))
// Objectif : proposé par le joueur (à valider), ou posé directement « en cours » par l'admin pendant l'entretien
export const useSaveGoal = () => useFollowMutation(async (v: GoalInput & { id?: string; enrollmentId: string; playerId: string; validate?: boolean }) => {
  const fields = { central: v.central.trim(), means: v.means.map(m => m.trim()).filter(Boolean), target_label: v.target_label.trim(), due_on: v.due_on }
  const validated = v.validate ? { status: 'en_cours' } : {} // validé par / le : posés par la base (0050)
  done(v.id
    ? await supabase.from('follow_goals').update({ ...fields, ...validated }).eq('id', v.id).select('id').single()
    : await supabase.from('follow_goals').insert({ ...fields, ...validated, enrollment_id: v.enrollmentId, player_id: v.playerId }))
})
export const useDeleteGoal = () => useFollowMutation(async (id: string) => done(await supabase.from('follow_goals').delete().eq('id', id)))

// ---------- Admin ----------
export function useFollowPlayers() {
  return useQuery({ queryKey: ['follow', 'players'], staleTime: 5 * 60_000,
    // Tous les joueurs, compte de test compris : il sert à essayer le suivi (caché partout ailleurs)
    queryFn: async () => rows(await supabase.from('profiles').select('id, first_name, last_name, is_test').eq('role', 'player').order('last_name')) })
}
export function useRequestNotes() {
  return useQuery({ queryKey: ['follow', 'notes'], queryFn: async () => rows(await supabase.from('follow_request_notes').select('request_id, notes')) })
}
export const useHandleRequest = () => useFollowMutation(async (v: { id: string; status: 'confirme' | 'autre_creneau' | 'refuse' | 'realise'; slot?: Slot }) =>
  done(await supabase.from('follow_requests').update({ status: v.status,
    ...(v.status === 'confirme' ? { confirmed_slot: v.slot } : v.status === 'autre_creneau' ? { proposed_slot: v.slot } : {}) })
    // seulement une demande encore ouverte : si le joueur vient d'annuler, on ne la ressuscite pas
    .eq('id', v.id).in('status', OPEN_REQUEST).select('id').single()))
export const useSaveNotes = () => useFollowMutation(async (v: { requestId: string; notes: string }) =>
  done(await supabase.from('follow_request_notes').upsert({ request_id: v.requestId, notes: v.notes.trim() })))
export const useActivateModule = () => useFollowMutation(async (v: { playerId: string; module: string }) =>
  done(await supabase.from('follow_enrollments').insert({ player_id: v.playerId, module_code: v.module })))
export const useSetGoalStatus = () => useFollowMutation(async (v: { id: string; status: string }) =>
  done(await supabase.from('follow_goals').update({ status: v.status }).eq('id', v.id).select('id').single()))

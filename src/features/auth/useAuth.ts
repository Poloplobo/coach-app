import { unsubscribeThisDevice } from '../settings/usePush'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { toAuthEmail } from '../../lib/login'
import type { Database } from '../../lib/database.types'

export type Role = Database['public']['Enums']['user_role']

// La session est poussée dans le cache par onAuthStateChange (main.tsx)
export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
    staleTime: Infinity,
  })
}

// Dans un écran protégé par RequireRole, la session existe toujours
export function useUserId(): string {
  const id = useSession().data?.user.id
  if (!id) throw new Error('useUserId hors d\'un écran protégé par RequireRole')
  return id
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles').select('id, role, first_name, last_name, is_test').eq('id', userId!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export { toAuthEmail }

// Mauvais identifiant ou mot de passe, à distinguer d'une coupure réseau
export const isWrongCredentials = (error: unknown) =>
  (error as { code?: string } | null)?.code === 'invalid_credentials'

export function useSignIn() {
  return useMutation({
    mutationFn: async ({ identifier, password }: { identifier: string; password: string }) => {
      const { error } = await supabase.auth.signInWithPassword({ email: toAuthEmail(identifier), password })
      if (error) throw error
    },
  })
}

export const MIN_PASSWORD_LENGTH = 8

// Le joueur remplace le mot de passe provisoire reçu du staff. Le mot de passe actuel est redemandé :
// un téléphone resté connecté ne suffit pas à s'approprier le compte.
export function useChangePassword() {
  return useMutation({
    mutationFn: async ({ current, next }: { current: string; next: string }) => {
      if (next.length < MIN_PASSWORD_LENGTH) throw new Error('mot de passe trop court')
      const email = (await supabase.auth.getUser()).data.user?.email
      if (!email) throw new Error('session expirée')
      const check = await supabase.auth.signInWithPassword({ email, password: current })
      if (check.error) throw check.error
      const { error } = await supabase.auth.updateUser({ password: next })
      if (error) throw error
    },
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await unsubscribeThisDevice()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSettled: () => queryClient.clear(), // même si le réseau échoue : rien d'un joueur ne reste en mémoire
  })
}

export const homePath = (role: Role) => (role === 'player' ? '/joueur' : '/staff')

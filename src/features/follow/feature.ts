import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

// Drapeau du suivi individuel (étape 14). Fichier à part : c'est tout ce que le reste de l'app charge tant que le
// drapeau est fermé ; les écrans et leurs requêtes sont téléchargés à la demande.
export const FEATURE = 'suivi_individuel'

export function useFeatureQuery(feature: string = FEATURE) {
  return useQuery({
    queryKey: ['feature', feature],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('has_feature', { p_feature: feature })
      if (error) throw error
      return data
    },
  })
}
// Faux pendant le chargement et en cas d'erreur : rien ne s'affiche tant qu'on n'est pas sûr
export const useFeature = (feature: string = FEATURE): boolean => useFeatureQuery(feature).data === true

// Compte de test : en lecture seule, sauf s'il est inscrit comme testeur du suivi (la base décide, 0050).
// enabled : seulement pour un compte de test ; pendant le chargement, on le considère en lecture seule.
export function useReadOnlyTest(enabled: boolean): boolean {
  const q = useQuery({
    enabled,
    queryKey: ['readOnlyTest'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_test_user')
      if (error) throw error
      return data
    },
  })
  return enabled && q.data !== false
}

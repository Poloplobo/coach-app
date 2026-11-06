import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

// Plan de retour du joueur connecté pour sa blessure en cours (0036) : étapes et date de début, jamais le diagnostic
export function useReturnPlan() {
  return useQuery({
    queryKey: ['returnPlan'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_return_plan')
      if (error) throw error
      return data.map(s => ({ ...s, position: s.step }))
    },
  })
}

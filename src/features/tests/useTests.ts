import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

export function useTestResults(playerId: string) {
  return useQuery({
    queryKey: ['testResults', playerId],
    queryFn: async () => {
      const { data, error } = await supabase.from('test_results')
        .select('test_id, test_date, value, test_definitions(name, unit, higher_is_better)').eq('player_id', playerId)
      if (error) throw error
      return data
    },
  })
}

export function useTargets(playerId: string, season: string) {
  return useQuery({
    queryKey: ['targets', playerId, season],
    queryFn: async () => {
      const { data, error } = await supabase.from('player_targets')
        .select('test_id, target_value, label, test_definitions(name, unit, higher_is_better)')
        .eq('player_id', playerId).eq('season', season)
      if (error) throw error
      return data
    },
  })
}

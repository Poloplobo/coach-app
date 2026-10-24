import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import type { WellnessItems } from './items'

export { WELLNESS_ITEMS, WELLNESS_MAX, type WellnessItems, type WellnessKey } from './items'

// « soreness » : ancienne question unique, encore présente dans l'historique importé
const COLUMNS = 'entry_date, sleep_quality, fatigue, soreness, soreness_upper, soreness_lower, stress, mood, score'

export function useWellnessDay(playerId: string, date: string) {
  return useQuery({
    queryKey: ['wellness', playerId, date],
    queryFn: async () => {
      const { data, error } = await supabase.from('wellness_entries').select(COLUMNS)
        .eq('player_id', playerId).eq('entry_date', date).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useWellnessRange(playerId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['wellness', playerId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from('wellness_entries').select(COLUMNS)
        .eq('player_id', playerId).gte('entry_date', from).lte('entry_date', to)
      if (error) throw error
      return data
    },
  })
}

// Une saisie par jour : la refaire le même jour la modifie (la base refuse un jour passé)
export function useSaveWellness(playerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ date, items }: { date: string; items: WellnessItems }) => {
      const { error } = await supabase.from('wellness_entries')
        .upsert({ player_id: playerId, entry_date: date, ...items }, { onConflict: 'player_id,entry_date' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wellness', playerId] }),
  })
}

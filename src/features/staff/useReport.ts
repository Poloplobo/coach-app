import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

const check = <T,>({ data, error }: { data: T; error: unknown }): NonNullable<T> => { if (error) throw error; return (data ?? []) as NonNullable<T> }

// Objectifs chiffrés d'un joueur pour la saison, avec l'exercice lié à chaque test (bilan de cycle)
export function usePlayerTargets(playerId: string, season: string) {
  return useQuery({
    enabled: !!playerId && !!season,
    queryKey: ['staff', 'targets', playerId, season],
    queryFn: async () => check(await supabase.from('player_targets')
      .select('target_value, label, test_definitions(id, name, unit, higher_is_better, exercise_id, exercises(name))')
      .eq('player_id', playerId).eq('season', season)),
  })
}

// Lien test ↔ exercice, saisi une fois pour toute l'équipe (RLS : staff seulement)
export function useLinkTestExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ testId, exerciseId }: { testId: string; exerciseId: string | null }) => {
      // La RLS ne lève pas d'erreur sur un update refusé : aucune ligne renvoyée = non enregistré
      if (!check(await supabase.from('test_definitions').update({ exercise_id: exerciseId }).eq('id', testId).select('id')).length) throw new Error('lien refusé')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff', 'targets'] }),
  })
}

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

// Profil de saison (PPID) affiché au joueur : jamais l'objectif santé, donnée réservée au staff à l'écran
export function useSeasonProfile(playerId: string, season: string) {
  return useQuery({
    queryKey: ['seasonProfile', playerId, season],
    queryFn: async () => {
      const { data, error } = await supabase.from('player_season_profiles')
        .select('profile_type, main_objective, power_to_develop').eq('player_id', playerId).eq('season', season).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

// Barème FFR des coqs (0044) et noms des tests, pour retrouver le barème 1RM d'un test 3RM
export function useTestReference() {
  return useQuery({
    queryKey: ['testReference'],
    staleTime: Infinity,
    queryFn: async () => {
      const [refs, defs] = await Promise.all([supabase.from('test_reference').select('test_id, position_group, blue, green, yellow'),
        supabase.from('test_definitions').select('id, name')])
      if (refs.error) throw refs.error
      if (defs.error) throw defs.error
      return { refs: refs.data, defs: defs.data }
    },
  })
}

// Poste du joueur (fiche) : choisit la colonne du barème
export function usePlayerPosition(playerId: string) {
  return useQuery({
    queryKey: ['position', playerId],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('position').eq('id', playerId).maybeSingle()
      if (error) throw error
      return data?.position ?? null
    },
  })
}

// Médailles du joueur connecté : podium du groupe sur chaque test (0044), sans les valeurs des autres
export function useMyMedals(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['myMedals'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_test_medals')
      if (error) throw error
      return new Map(data.map(m => [m.test_id, m.medal as Medal]))
    },
  })
}
export type Medal = 'or' | 'argent' | 'bronze'

// Staff : derniers tests de tout l'effectif (RLS : le staff lit tout), joueur de test exclu
export function useGroupTestResults() {
  return useQuery({
    queryKey: ['staff', 'testResults'],
    queryFn: async () => {
      const { data, error } = await supabase.from('test_results')
        .select('player_id, test_id, test_date, value, test_definitions(name, unit, higher_is_better), profiles!inner(is_test)')
        .eq('profiles.is_test', false).order('test_date')
      if (error) throw error
      return data
    },
  })
}

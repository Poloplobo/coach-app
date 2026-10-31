import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { parisDate } from '../../lib/week'
import type { GpsRecord, GpsReference, RatingColor } from './gps'
import type { GpsRow } from './importGps'
import type { MaxiRow } from './importMaxi'

const check = <T,>({ data, error }: { data: T; error: unknown }): NonNullable<T> => { if (error) throw error; return (data ?? []) as NonNullable<T> }

// Référentiel des attendus et correspondance poste saisi → groupe de poste (lisibles par tous les connectés)
export function useGpsReference() {
  return useQuery({
    queryKey: ['performance', 'reference'], staleTime: Infinity,
    queryFn: async () => {
      const refs = check(await supabase.from('gps_reference').select('position_group, distance_m, accelerations, hi_distance_m, ref_minutes')) as GpsReference[]
      const positions = check(await supabase.from('gps_positions').select('position, position_group'))
      return { refs: new Map(refs.map(r => [r.position_group, r])), positions: new Map(positions.map(p => [p.position, p.position_group])) }
    },
  })
}

// Match créé ou retrouvé, GPS enregistrés et lignes absentes du fichier retirées, en une transaction (import_match_gps)
export function useImportGps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { groupId: string; date: string; opponent: string; label: string; rows: GpsRow[] }) =>
      check(await supabase.rpc('import_match_gps', {
        p_group: v.groupId, p_date: v.date, p_opponent: v.opponent, p_label: v.label,
        p_rows: v.rows.map(r => ({ player_id: r.player.id, position: r.position, minutes: r.minutes, distance_m: r.distance_m,
          hi_distance_m: r.hi_distance_m, accelerations: r.accelerations, vmax: r.vmax })),
      })) as { rows: number; removed: number },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['performance'] }); qc.invalidateQueries({ queryKey: ['staff'] }) },
  })
}

// Maxi = résultat de test daté (l'historique reste), objectif = objectif de la saison (remplacé)
export function useImportMaxi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { date: string; period: string; season: string; rows: MaxiRow[] }) => {
      const results = v.rows.filter(r => r.maxi !== null).map(r => ({ player_id: r.player.id, test_id: r.test.id, test_date: v.date, ...(v.period ? { period: v.period } : {}), value: r.maxi! })) // sans période : celle déjà saisie reste
      const targets = v.rows.filter(r => r.target !== null).map(r => ({ player_id: r.player.id, season: v.season, test_id: r.test.id, target_value: r.target!, label: r.label }))
      if (results.length) check(await supabase.from('test_results').upsert(results, { onConflict: 'player_id,test_id,test_date' }).select('player_id'))
      if (targets.length) check(await supabase.from('player_targets').upsert(targets, { onConflict: 'player_id,season,test_id' }).select('player_id'))
      return { results: results.length, targets: targets.length }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['performance'] }); qc.invalidateQueries({ queryKey: ['staff'] }) },
  })
}

export type Match = { id: string; match_date: string; opponent: string; label: string | null }
export type Rating = { match_id: string; player_id: string; rater: 'player' | 'staff'; color: RatingColor }

// shortcut: un seul groupe (PER) : tous les matchs sont ceux du joueur ; filtrer par group_members s'il y en a plusieurs
export function useMatches() {
  return useQuery({
    queryKey: ['performance', 'matches'],
    queryFn: async () => check(await supabase.from('matches').select('id, match_date, opponent, label')
      .lte('match_date', parisDate()).order('match_date', { ascending: false })) as Match[],
  })
}

// GPS et notes : la RLS ne rend au joueur que les siens, et la note staff seulement après sa propre note
export function useGpsRecords(playerId?: string) {
  return useQuery({
    queryKey: ['performance', 'gps', playerId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('gps_records').select('match_id, player_id, position, minutes, distance_m, hi_distance_m, accelerations, vmax')
      if (playerId) q = q.eq('player_id', playerId)
      return check(await q) as GpsRecord[]
    },
  })
}

export function useRatings(playerId?: string) {
  return useQuery({
    queryKey: ['performance', 'ratings', playerId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('match_ratings').select('match_id, player_id, rater, color')
      if (playerId) q = q.eq('player_id', playerId)
      return check(await q) as Rating[]
    },
  })
}

// Le joueur note son match (rater player), le staff note le joueur (rater staff) : la RLS refuse tout autre cas
export function useRateMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (r: Rating) => {
      check(await supabase.from('match_ratings').upsert({ ...r, updated_at: new Date().toISOString() }, { onConflict: 'match_id,player_id,rater' }).select('match_id'))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['performance', 'ratings'] }),
  })
}

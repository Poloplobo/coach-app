import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import type { GpsReference } from './gps'
import type { GpsRow } from './importGps'

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

// Match créé (ou retrouvé : même groupe, date et adversaire) puis GPS de chaque joueur ; un réimport corrige les lignes
export function useImportGps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { groupId: string; date: string; opponent: string; label: string; rows: GpsRow[] }) => {
      const match = check(await supabase.from('matches').upsert(
        { group_id: v.groupId, match_date: v.date, opponent: v.opponent.trim(), label: v.label.trim() || null },
        { onConflict: 'group_id,match_date,opponent' }).select('id').single())
      check(await supabase.from('gps_records').upsert(v.rows.map(r => ({
        match_id: match.id, player_id: r.player.id, position: r.position, minutes: r.minutes,
        distance_m: r.distance_m, hi_distance_m: r.hi_distance_m, accelerations: r.accelerations, vmax: r.vmax,
      })), { onConflict: 'match_id,player_id' }).select('id'))
      return v.rows.length
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['performance'] }); qc.invalidateQueries({ queryKey: ['staff'] }) },
  })
}

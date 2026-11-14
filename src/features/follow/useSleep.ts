import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

// Suivi sommeil (étape 14) : nuits saisies, routines et coches. RLS : le joueur lit et écrit les siennes, admin seul côté staff.

const rows = <T,>({ data, error }: { data: T[] | null; error: unknown }): T[] => {
  if (error) throw error
  return data ?? []
}
const done = ({ error }: { error: unknown }) => { if (error) throw error }

export function useSleepEntries(playerId: string, from: string) {
  return useQuery({ queryKey: ['follow', 'sleep', playerId, from],
    queryFn: async () => rows(await supabase.from('sleep_entries')
      .select('night_date, bed_time, asleep_time, wake_time, awakenings, awake_min, phone_free_min, feeling, nap_min, caffeine_late, note, duration_min')
      .eq('player_id', playerId).gte('night_date', from).order('night_date', { ascending: false })) })
}
export function useRoutines(playerId: string) {
  return useQuery({ queryKey: ['follow', 'routines', playerId],
    queryFn: async () => rows(await supabase.from('sleep_routines').select('id, label, active').eq('player_id', playerId).order('created_at')) })
}
export function useRoutineChecks(playerId: string, from: string) {
  return useQuery({ queryKey: ['follow', 'checks', playerId, from],
    queryFn: async () => rows(await supabase.from('sleep_routine_checks').select('routine_id, night_date').eq('player_id', playerId).gte('night_date', from)) })
}
export type SleepEntry = NonNullable<ReturnType<typeof useSleepEntries>['data']>[number]
export type Routine = NonNullable<ReturnType<typeof useRoutines>['data']>[number]
export type SleepInput = Omit<SleepEntry, 'duration_min'>

function useSleepMutation<V>(fn: (v: V) => Promise<void>) {
  const qc = useQueryClient()
  // onSettled : même si une étape échoue à mi-chemin (nuit enregistrée, coches non), l'écran repart de ce qui est en base
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries({ queryKey: ['follow'] }) })
}

// La nuit et ses routines cochées, en un enregistrement : une ligne par joueur et par nuit, la resaisir la corrige
export const useSaveSleep = (playerId: string) => useSleepMutation(async (v: { entry: SleepInput; routines: { id: string; checked: boolean }[] }) => {
  done(await supabase.from('sleep_entries').upsert({ ...v.entry, player_id: playerId }, { onConflict: 'player_id,night_date' }))
  const on = v.routines.filter(r => r.checked).map(r => ({ routine_id: r.id, player_id: playerId, night_date: v.entry.night_date }))
  const off = v.routines.filter(r => !r.checked).map(r => r.id)
  if (on.length) done(await supabase.from('sleep_routine_checks').upsert(on, { onConflict: 'routine_id,night_date', ignoreDuplicates: true }))
  if (off.length) done(await supabase.from('sleep_routine_checks').delete().eq('player_id', playerId).eq('night_date', v.entry.night_date).in('routine_id', off))
})
export const useAddRoutine = (playerId: string) => useSleepMutation(async (label: string) =>
  done(await supabase.from('sleep_routines').insert({ player_id: playerId, label: label.trim() })))
export const useSetRoutineActive = () => useSleepMutation(async (v: { id: string; active: boolean }) =>
  done(await supabase.from('sleep_routines').update({ active: v.active }).eq('id', v.id).select('id').single()))

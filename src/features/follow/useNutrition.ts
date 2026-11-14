import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import type { Meal } from './nutrition'

// Suivi nutrition (étape 14). RLS : le joueur lit et écrit son journal (aujourd'hui et hier), admin seul côté staff.
// Les valeurs nutritionnelles (food_nutrients) ne sont demandées que par l'écran admin : la RLS les refuse à un joueur.

const rows = <T,>({ data, error }: { data: T[] | null; error: unknown }): T[] => {
  if (error) throw error
  return data ?? []
}
const done = ({ error }: { error: unknown }) => { if (error) throw error }

const ITEM = 'id, day, meal, course, quantity, unit, grams, food:foods(id, name, category)'
export function useMealItems(playerId: string, from: string) {
  return useQuery({ queryKey: ['follow', 'meals', playerId, from],
    queryFn: async () => rows(await supabase.from('meal_items').select(ITEM).eq('player_id', playerId).gte('day', from).order('created_at')) })
}
// Écran admin : le même journal avec les valeurs pour 100 g
export function useMealItemsWithNutrients(playerId: string, from: string, enabled: boolean) {
  return useQuery({ queryKey: ['follow', 'meals-staff', playerId, from], enabled,
    queryFn: async () => rows(await supabase.from('meal_items')
      .select('id, grams, food:foods(nutrients:food_nutrients(kcal, protein_g, carbs_g, fat_g))').eq('player_id', playerId).gte('day', from)) })
}
export function useHydration(playerId: string, from: string) {
  return useQuery({ queryKey: ['follow', 'water', playerId, from],
    queryFn: async () => rows(await supabase.from('hydration_entries').select('id, day, ml').eq('player_id', playerId).gte('day', from).order('created_at')) })
}
export type MealItem = NonNullable<ReturnType<typeof useMealItems>['data']>[number]
export type Food = NonNullable<MealItem['food']>

// Recherche à partir de 2 lettres ; le résultat précédent reste affiché pendant la frappe
export function useFoodSearch(term: string) {
  const t = term.trim()
  return useQuery({ queryKey: ['follow', 'foods', t], enabled: t.length >= 2, staleTime: 5 * 60_000, placeholderData: prev => prev,
    queryFn: async () => rows(await supabase.rpc('search_foods', { p_term: t })) })
}

function useNutritionMutation<V, R = void>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries({ queryKey: ['follow'] }) })
}
export const useAddMealItem = (playerId: string) => useNutritionMutation(async (v: {
  day: string; meal: Meal; course: string | null; food_id: string; quantity: number; unit: string; grams: number
}) => done(await supabase.from('meal_items').insert({ ...v, player_id: playerId })))
export const useDeleteMealItem = () => useNutritionMutation(async (id: string) =>
  done(await supabase.from('meal_items').delete().eq('id', id)))
export const useAddWater = (playerId: string) => useNutritionMutation(async (v: { day: string; ml: number }) =>
  done(await supabase.from('hydration_entries').insert({ ...v, player_id: playerId })))
export const useDeleteWater = () => useNutritionMutation(async (id: string) =>
  done(await supabase.from('hydration_entries').delete().eq('id', id)))
// Aliment personnel, visible de son auteur et de l'admin seulement
export const useAddFood = (playerId: string) => useNutritionMutation(async (v: { name: string; category: string }): Promise<Food> => {
  const { data, error } = await supabase.from('foods').insert({ name: v.name.trim(), category: v.category, owner_id: playerId }).select('id, name, category').single()
  if (error) throw error
  return data
})

import { expect, it, vi } from 'vitest'
import { PAGE, fetchAll } from './fetchAll'

it('lit toutes les lignes au-delà de la limite de 1000 de Supabase, page par page', async () => {
  const table = Array.from({ length: 2500 }, (_, i) => i)
  const page = vi.fn(async (from: number, to: number) => ({ data: table.slice(from, to + 1), error: null }))
  expect(await fetchAll(page)).toEqual(table)
  expect(page.mock.calls).toEqual([[0, PAGE - 1], [PAGE, 2 * PAGE - 1], [2 * PAGE, 3 * PAGE - 1]])
})

it('exactement 1000 lignes : une page vide de plus, puis arrêt', async () => {
  const table = Array.from({ length: PAGE }, (_, i) => i)
  const page = vi.fn(async (from: number, to: number) => ({ data: table.slice(from, to + 1), error: null }))
  expect(await fetchAll(page)).toHaveLength(PAGE)
  expect(page).toHaveBeenCalledTimes(2)
})

it('une erreur sur une page fait échouer toute la lecture (pas de résultat partiel silencieux)', async () => {
  const page = vi.fn(async (from: number) => (from === 0 ? { data: Array(PAGE).fill(0), error: null } : { data: null, error: new Error('réseau') }))
  await expect(fetchAll(page)).rejects.toThrow('réseau')
})

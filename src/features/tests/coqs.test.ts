import { describe, expect, it } from 'vitest'
import { coqOf, ffrPosition, groupPodium, testCoq } from './coqs'

const defs = [{ id: 'dc1', name: 'Développé Couché 1RM' }, { id: 'bs1', name: 'Back Squat 1RM' }, { id: 's10', name: 'Sprint 10m' }]
const refs = [
  { test_id: 'dc1', position_group: 'Pilier', blue: 125.5, green: 115, yellow: 105 },
  { test_id: 'bs1', position_group: 'Centre', blue: 160, green: 145, yellow: 115 },
  { test_id: 's10', position_group: 'Demi de mêlée', blue: 1.67, green: 1.71, yellow: 1.8 },
]

describe('coqs FFR', () => {
  it('poste de la fiche → colonne du barème', () => {
    expect(['Pilier', 'Talon', '2ème Ligne', '3ème Ligne', 'Charnière', 'Ouvreur', 'Centre', 'Ailier', 'Arrière', null].map(ffrPosition))
      .toEqual(['Pilier', 'Talonneur', '2e ligne', '3e ligne', 'Demi de mêlée', "Demi d'ouverture", 'Centre', 'Ailier', 'Arrière', null])
  })
  it('échelon inférieur entre deux seuils ; temps : plus bas = mieux', () => {
    expect(coqOf(135, { blue: 125.5, green: 115, yellow: 105 }, true)).toBe('bleu') // exemple FFR : pilier 135 kg
    expect(coqOf(100, { blue: 125.5, green: 115, yellow: 105 }, true)).toBe('rouge') // exemple FFR : pilier 100 kg
    expect(coqOf(115, { blue: 125.5, green: 115, yellow: 105 }, true)).toBe('vert')
    expect(coqOf(1.7, { blue: 1.67, green: 1.71, yellow: 1.8 }, false)).toBe('vert')
    expect(coqOf(1.81, { blue: 1.67, green: 1.71, yellow: 1.8 }, false)).toBe('rouge')
  })
  it('3RM converti en 1RM estimé, front squat en back squat', () => {
    const dc = testCoq({ testName: 'Développé Couché 3RM', value: 110, higherIsBetter: true, position: 'Pilier' }, refs, defs)
    expect(dc).toMatchObject({ color: 'vert', estimated: true }) // 110 × 36/34 ≈ 116,5
    const fs = testCoq({ testName: 'Front Squat 3RM', value: 115, higherIsBetter: true, position: 'Centre' }, refs, defs)
    expect(fs?.color).toBe('jaune') // 115 × 36/34 / 0,85 ≈ 143,2 : sous le vert (145), au-dessus du jaune (115)
  })
  it('sans barème ou sans poste : pas de coq', () => {
    expect(testCoq({ testName: 'Traction Stricte', value: 12, higherIsBetter: true, position: 'Pilier' }, refs, defs)).toBeNull()
    expect(testCoq({ testName: 'Sprint 10m', value: 1.7, higherIsBetter: false, position: null }, refs, defs)).toBeNull()
  })
})

it('podium du groupe : 3 meilleures valeurs, ex aequo même médaille, temps croissants', () => {
  const m = groupPodium([
    { player_id: 'a', test_id: 'cmj', value: 45, higherIsBetter: true }, { player_id: 'b', test_id: 'cmj', value: 45, higherIsBetter: true },
    { player_id: 'c', test_id: 'cmj', value: 40, higherIsBetter: true }, { player_id: 'd', test_id: 'cmj', value: 38, higherIsBetter: true },
    { player_id: 'e', test_id: 'cmj', value: 30, higherIsBetter: true },
    { player_id: 'a', test_id: 's10', value: 1.8, higherIsBetter: false }, { player_id: 'b', test_id: 's10', value: 1.7, higherIsBetter: false },
  ])
  expect(['a', 'b', 'c', 'd', 'e'].map(p => m.get(`${p}|cmj`))).toEqual(['or', 'or', 'argent', 'bronze', undefined])
  expect([m.get('b|s10'), m.get('a|s10')]).toEqual(['or', 'argent'])
})

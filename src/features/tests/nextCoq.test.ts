import { expect, it } from 'vitest'
import { nextCoq } from './nextCoq'

const ref = { blue: 45, green: 40, yellow: 35 }

it('plus haut = mieux : CMJ 39 cm, coq jaune : encore 1 cm pour le vert ; bleu : plus rien', () => {
  expect(nextCoq({ color: 'jaune', value: 39, ref }, true)).toEqual({ color: 'vert', gap: 1 })
  expect(nextCoq({ color: 'rouge', value: 30, ref }, true)).toEqual({ color: 'jaune', gap: 5 })
  expect(nextCoq({ color: 'bleu', value: 47, ref }, true)).toBeNull()
})

it('plus bas = mieux : sprint 1,89 s, coq jaune (seuils 1,75 / 1,82 / 1,90) : encore 0,07 s pour le vert', () => {
  const g = nextCoq({ color: 'jaune', value: 1.89, ref: { blue: 1.75, green: 1.82, yellow: 1.9 } }, false)!
  expect(g.color).toBe('vert')
  expect(g.gap).toBeCloseTo(0.07)
})

it('test converti (3RM → 1RM) : écart rendu dans l\'unité du test passé', () => {
  // 87,5 kg de 3RM × 36/34 ≈ 92,6 kg de 1RM ; seuil vert à 95 : il manque ≈ 2,4 kg de 1RM, soit ≈ 2,3 kg de 3RM
  const f = 36 / 34
  const g = nextCoq({ color: 'jaune', value: 87.5 * f, ref: { blue: 110, green: 95, yellow: 85 } }, true, f)!
  expect(g.gap).toBeCloseTo(95 / f - 87.5)
})

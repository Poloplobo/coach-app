import { expect, it } from 'vitest'
import { isTabLocked } from './playerDay'

it('état de forme non rempli : Accueil, Séance, Rugby et toute adresse inconnue sont verrouillés', () => {
  for (const p of ['/joueur', '/joueur/', '/joueur/seance', '/joueur/rugby', '/joueur/nimporte-quoi']) expect(isTabLocked(p, true)).toBe(true)
})

it('état de forme non rempli : Forme et Réglages restent accessibles (déconnexion possible)', () => {
  expect(isTabLocked('/joueur/forme', true)).toBe(false)
  expect(isTabLocked('/joueur/reglages', true)).toBe(false)
})

it('état de forme rempli : tout est accessible', () => {
  for (const p of ['/joueur', '/joueur/seance', '/joueur/rugby']) expect(isTabLocked(p, false)).toBe(false)
})

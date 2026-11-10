import { expect, it } from 'vitest'
import { dayFocus, sessionActivity } from './parseMuscu'

it('intitulé de la séance lu sur la ligne du jour', () => {
  expect(dayFocus('Lundi - Puissance BDC')).toBe('Puissance BDC')
  expect(dayFocus('Mardi : Force HDC :')).toBe('Force HDC')
  expect(dayFocus('Lundi (Force & Squat)')).toBe('Force & Squat')
  expect(dayFocus('Mercredi – Puissance & Vitesse')).toBe('Puissance & Vitesse')
  expect(dayFocus('Lundi RÉHAB : Genou')).toBe('Genou')
  expect(dayFocus('Lundi : ')).toBeUndefined()
  expect(dayFocus('Vendredi')).toBeUndefined()
  expect(dayFocus('Lundi MEMBRES SAINS :')).toBeUndefined()
  expect(sessionActivity('Lundi RÉHAB : Genou')).toBe('Réhabilitation')
})

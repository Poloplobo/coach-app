import { expect, it } from 'vitest'
import { loadGauge } from './loadGauge'

it('jauge de charge : position, plage et statut', () => {
  expect(loadGauge(2000, 1500, 2500)).toEqual({ fill: 66.7, bandFrom: 50, bandTo: 83.3, where: 'in' })
  expect(loadGauge(600, 1500, 2500).where).toBe('below')
  expect(loadGauge(4850, 1500, 2500)).toMatchObject({ where: 'above', fill: 95.2 }) // très au-dessus : la jauge ne déborde pas
  expect(loadGauge(3000, 2500, null)).toMatchObject({ where: 'in', bandTo: 100 }) // DEV : pas de maximum
  expect(loadGauge(0, 0, null)).toMatchObject({ fill: 0, where: 'in' })
})

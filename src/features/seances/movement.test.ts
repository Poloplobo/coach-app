import { expect, it } from 'vitest'
import { movementOf } from './movement'

it('reconnaît la famille de mouvement des noms de la base, sans accents ni casse', () => {
  expect(movementOf('Back Squat')).toBe('squat')
  expect(movementOf('Fentes Bulgares ISO')).toBe('lunge')
  expect(movementOf('Split squat')).toBe('lunge') // fente avant squat
  expect(movementOf('Élévation ISO GHD')).toBe('hinge')
  expect(movementOf('Soulevé de terre roumain')).toBe('hinge')
  expect(movementOf('Psoas ISO')).toBe('core')
  expect(movementOf('Side Gainage')).toBe('core')
  expect(movementOf('Crunch')).toBe('core') // « crunch » contient « run » : pas du cardio
  expect(movementOf('Box jump')).toBe('jump')
  expect(movementOf('Jump squat')).toBe('jump') // saut avant squat
  expect(movementOf('Développé couché')).toBe('push_h') // « developpe » contient « velo » : pas du cardio
  expect(movementOf('Développé militaire')).toBe('push_v')
  expect(movementOf('Tractions')).toBe('pull_v')
  expect(movementOf('Tirage vertical')).toBe('pull_v')
  expect(movementOf('Rowing haltère')).toBe('pull_h')
  expect(movementOf('Pallof press')).toBe('rotation')
  expect(movementOf('Farmer walk')).toBe('carry')
  expect(movementOf('Vélo')).toBe('cardio')
})

it('exercice non reconnu : pas de pictogramme', () => {
  expect(movementOf('Rotation externe épaule élastique')).toBe('rotation')
  expect(movementOf('Étirements')).toBeNull()
  expect(movementOf('')).toBeNull()
})

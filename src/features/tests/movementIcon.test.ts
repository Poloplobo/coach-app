import { describe, expect, it } from 'vitest'
import { Activity, ArrowUpFromLine, Dumbbell, MoveUp, Repeat, Shield, Weight, Zap } from 'lucide-react'
import { movementIcon } from './movementIcon'

describe('movementIcon : pictogramme des tests du référentiel', () => {
  it.each([
    ['Back Squat 1RM', Weight], ['Front Squat 3RM', Weight], ['Développé Couché 1RM', Dumbbell], ['Développé Militaire 3RM', Dumbbell],
    ['Traction Stricte', ArrowUpFromLine], ['CMJ', MoveUp], ['Broad Jump', MoveUp], ['Sprint 10m', Zap], ['Sprint 50m', Zap],
    ['10m Fly', Zap], ['Vmax', Zap], ['Yo-Yo Test', Repeat], ['Gainage Planche', Shield], ['Force Cervicale', Shield],
    ['K-Push Flexion', Dumbbell], ['Test inconnu', Activity],
  ])('%s', (name, icon) => { expect(movementIcon(name)).toBe(icon) })
})

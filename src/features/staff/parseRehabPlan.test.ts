import { describe, expect, it } from 'vitest'
import { parseRehabRows } from './parseRehabPlan'

const head = ['Étape', 'Objectifs', 'Actions Kiné', 'Actions Prépa', 'Statut', 'Commentaires']
const rows = [
  ['PLAN DE RÉHABILITATION - JOUEUR FICTIF'], [],
  ['Date de début', 'Phase actuelle'], [46259, 'Phase 2'], [],
  head,
  ['Phase 1 : Soins (S1-S2) - 14 JOURS'],
  ['Antalgie', 'Protéger', 'Cryo', 'Vélo', 'Terminé', 'Écharpe'],
  ['Mobilité', 'Bouger', 'Massage', 'Gainage', 'Terminé', ''],
  ['TEST CLINIQUE (J15)', 'Contrôle', 'Bilan', 'Amplitudes', 'Terminé', 46274],
  ['Phase 2 : Reprise (S3-S4) - 14 JOURS'],
  ['Force', 'Gagner', '', 'Développé', 'En cours', ''],
  ['RADIO DE CONTRÔLE', 'Consolidation', 'Radio', '', 'À faire', '06/10/2026'],
]

describe('parseRehabRows', () => {
  const plan = parseRehabRows(rows, '2026-11-06')
  it('lit phases, étapes et tests', () => {
    expect(plan.heading).toBe('PLAN DE RÉHABILITATION - JOUEUR FICTIF')
    expect(plan.steps.map(s => s.title)).toEqual(['Antalgie', 'Mobilité', 'TEST CLINIQUE (J15)', 'Force', 'RADIO DE CONTRÔLE'])
    expect(plan.steps[0]).toMatchObject({ phase: 'Phase 1 : Soins (S1-S2)', phase_days: 14, objectives: 'Protéger', kine_actions: 'Cryo', prepa_actions: 'Vélo', comment: 'Écharpe' })
    expect(plan.steps.map(s => s.is_test)).toEqual([false, false, true, false, true])
  })
  it('répartit les jours de la phase et date les étapes terminées au test de la phase', () => {
    expect(plan.steps.map(s => s.planned_days)).toEqual([4, 5, 5, 7, 7])
    expect(plan.steps.slice(0, 3).map(s => s.validated_on)).toEqual(['2026-09-09', '2026-09-09', '2026-09-09'])
    expect(plan.steps[3]).toMatchObject({ validated_on: null, in_progress: true })
    expect(plan.steps[4]).toMatchObject({ validated_on: null, comment: 'Prévu le 06/10/2026' })
  })
  it('ne valide pas une étape terminée sans date passée', () => {
    const p = parseRehabRows([head, ['Phase 1 : X - 7 JOURS'], ['A', '', '', '', 'Terminé', ''], ['TEST', '', '', '', 'Terminé', '31/02/2026']], '2026-11-06')
    expect(p.steps.map(s => [s.validated_on, s.in_progress])).toEqual([[null, true], [null, true]])
  })
  it('refuse un fichier sans en-tête', () => {
    expect(() => parseRehabRows([['x']], '2026-11-06')).toThrow(/en-tête/)
  })
})

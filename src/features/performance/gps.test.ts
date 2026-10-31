import { describe, expect, it } from 'vitest'
import { gpsAnalysis, positionGroup, vmaxTimeline, type GpsReference } from './gps'

const ref = (position_group: string, distance_m: number, accelerations: number, hi_distance_m: number): GpsReference =>
  ({ position_group, distance_m, accelerations, hi_distance_m, ref_minutes: 70 })
const pilier = ref('Pilier', 4970, 15, 10)
const deuxieme = ref('2e ligne', 5670, 30, 20)
const positions = new Map([['PILIER', 'Pilier'], ['2ÈME LIGNE', '2e ligne'], ['3ÈME LIGNE', '3e ligne'], ['CHARNIÈRE', 'Demi de mêlée']])

describe('positionGroup : postes de l\'export GPS et des fiches joueurs', () => {
  it('casse et espaces ignorés, accents conservés', () => {
    expect(positionGroup(' Pilier ', positions)).toBe('Pilier')
    expect(positionGroup('2ème Ligne', positions)).toBe('2e ligne') // fiche joueur
    expect(positionGroup('2ÈME LIGNE', positions)).toBe('2e ligne') // export GPS
    expect(positionGroup('Charnière', positions)).toBe('Demi de mêlée')
  })
  it('poste inconnu ou absent : null (pas d\'attendu inventé)', () => {
    expect(positionGroup('Ouvreur', positions)).toBeNull()
    expect(positionGroup(null, positions)).toBeNull()
  })
})

describe('gpsAnalysis : mêmes résultats que le classeur « GPS - MATCH »', () => {
  it('ramené à 70 min : 3 310 m en 40 min pour un pilier = 117 % de l\'attendu, coefficient 1,75', () => {
    const a = gpsAnalysis({ minutes: 40, distance_m: 3310, hi_distance_m: 20, accelerations: 10 }, pilier)!
    expect(a.coefficient).toBe(1.75)
    expect(a.pct.distance).toBe(117)
    expect(a).toMatchObject({ filled: 3, color: 'bleu' }) // HI 350 %, accélérations 117 %
  })
  it('99,5 % s\'affiche 100 % mais ne remplit pas l\'attendu', () => {
    const a = gpsAnalysis({ minutes: 16, distance_m: 1290, hi_distance_m: 0, accelerations: 0 }, deuxieme)!
    expect(a.pct.distance).toBe(100)
    expect(a).toMatchObject({ filled: 0, color: 'rouge' })
  })
  it('couleur selon les attendus remplis : 1 jaune, 2 vert', () => {
    expect(gpsAnalysis({ minutes: 70, distance_m: 5000, hi_distance_m: 5, accelerations: 5 }, pilier)!.color).toBe('jaune')
    expect(gpsAnalysis({ minutes: 70, distance_m: 5000, hi_distance_m: 10, accelerations: 5 }, pilier)!.color).toBe('vert')
  })
  it('plus de 70 minutes : coefficient < 1', () => {
    expect(gpsAnalysis({ minutes: 80, distance_m: 5670, hi_distance_m: 20, accelerations: 30 }, deuxieme)).toMatchObject({ coefficient: 0.88, filled: 0 })
  })
  it('sans référentiel (poste inconnu) ou sans minutes : pas d\'analyse', () => {
    expect(gpsAnalysis({ minutes: 70, distance_m: 5000, hi_distance_m: 10, accelerations: 15 }, null)).toBeNull()
    expect(gpsAnalysis({ minutes: 0, distance_m: 5000, hi_distance_m: 10, accelerations: 15 }, pilier)).toBeNull()
  })
})

describe('vmaxTimeline', () => {
  it('première mesure, record battu, % de la meilleure à date, match sans Vmax', () => {
    const t = vmaxTimeline([
      { date: '2026-10-18', vmax: 27 }, { date: '2026-10-04', vmax: 26 }, { date: '2026-10-25', vmax: null }, { date: '2026-11-01', vmax: 26.5 },
    ])
    expect(t.map(x => [x.date, x.first, x.record, x.bestToDate, x.pctOfBest])).toEqual([
      ['2026-10-04', true, false, 26, 100],
      ['2026-10-18', false, true, 27, 100],
      ['2026-10-25', false, false, 27, null],
      ['2026-11-01', false, false, 27, 98],
    ])
  })
  it('Vmax de référence (test ou historique) : le premier match peut battre le record', () => {
    expect(vmaxTimeline([{ date: '2026-10-04', vmax: 29 }], 28.5)[0]).toMatchObject({ record: true, first: false, recordBefore: 28.5 })
  })
})

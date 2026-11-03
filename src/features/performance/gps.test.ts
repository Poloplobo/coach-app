import { describe, expect, it } from 'vitest'
import { gpsAnalysis, positionGroup, ratingSeason, vmaxTimeline, type GpsReference } from './gps'

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
    const a = gpsAnalysis({ minutes: 32, distance_m: 2580, hi_distance_m: 0, accelerations: 0 }, deuxieme)!
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
  it('moins de 20 minutes jouées : pas de % ni de couleur (2 min → 500 % n\'a pas de sens) ; 20 min : analysé', () => {
    expect(gpsAnalysis({ minutes: 1, distance_m: 100, hi_distance_m: 1, accelerations: 1 }, pilier)).toBeNull()
    expect(gpsAnalysis({ minutes: 19.5, distance_m: 2000, hi_distance_m: 10, accelerations: 10 }, pilier)).toBeNull()
    expect(gpsAnalysis({ minutes: 20, distance_m: 2000, hi_distance_m: 10, accelerations: 10 }, pilier)).toMatchObject({ coefficient: 3.5 })
  })
  it('valeurs à 0 : 0 %, rouge', () => {
    const a = gpsAnalysis({ minutes: 70, distance_m: 0, hi_distance_m: 0, accelerations: 0 }, pilier)!
    expect(a).toMatchObject({ pct: { distance: 0, hi: 0, accelerations: 0 }, filled: 0, color: 'rouge' })
  })
  it('exactement 100 % : attendu rempli', () => {
    expect(gpsAnalysis({ minutes: 70, distance_m: 4970, hi_distance_m: 10, accelerations: 15 }, pilier)).toMatchObject({ filled: 3, color: 'bleu' })
  })
  it('minutes négatives : pas d\'analyse', () => {
    expect(gpsAnalysis({ minutes: -5, distance_m: 5000, hi_distance_m: 10, accelerations: 15 }, pilier)).toBeNull()
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
  it('Vmax égale au record : ce n\'est pas un record, 100 %', () => {
    const t = vmaxTimeline([{ date: '2026-10-04', vmax: 27 }, { date: '2026-10-11', vmax: 27 }])
    expect(t[1]).toMatchObject({ record: false, first: false, recordBefore: 27, bestToDate: 27, pctOfBest: 100 })
    expect(vmaxTimeline([{ date: '2026-10-04', vmax: 28.5 }], 28.5)[0].record).toBe(false)
  })
  it('toutes les Vmax nulles : aucun record, aucun %, meilleure à date inchangée', () => {
    const t = vmaxTimeline([{ date: '2026-10-04', vmax: null }, { date: '2026-10-11', vmax: null }])
    expect(t.every(x => !x.record && !x.first && x.pctOfBest === null && x.bestToDate === null)).toBe(true)
    expect(vmaxTimeline([{ date: '2026-10-04', vmax: null }], 28)[0]).toMatchObject({ bestToDate: 28, pctOfBest: null })
  })
  it('liste vide', () => { expect(vmaxTimeline([])).toEqual([]) })
})

describe('ratingSeason', () => {
  it('range les matchs du plus ancien au plus récent avec les deux notes et le temps de jeu', () => {
    const matches = [
      { id: 'm2', match_date: '2026-11-01', opponent: 'ABCD XV', label: 'J3' },
      { id: 'm1', match_date: '2026-10-11', opponent: 'Racing 92', label: null },
    ]
    const ratings = [
      { match_id: 'm1', player_id: 'a', rater: 'staff' as const, color: 'bleu' as const, minutes: 70 },
      { match_id: 'm1', player_id: 'a', rater: 'player' as const, color: 'vert' as const },
      { match_id: 'm2', player_id: 'a', rater: 'staff' as const, color: 'gris' as const, minutes: 0 },
      { match_id: 'm2', player_id: 'b', rater: 'player' as const, color: 'rouge' as const },
    ]
    expect(ratingSeason(matches, ratings, 'a').map(({ name, staff, player, minutes }) => ({ name, staff, player, minutes }))).toEqual([
      { name: 'Racing 92', staff: 4, player: 3, minutes: 70 },
      { name: 'J3', staff: null, player: null, minutes: 0 }, // gris : n'a pas joué, hors courbe
    ])
  })
})

import { describe, expect, it } from 'vitest'
import type { GpsRecord, GpsReference } from './gps'
import { matchReport, playerReport, teamBlockReport } from './report'

const refRow = (position_group: string, distance_m: number, accelerations: number, hi_distance_m: number): GpsReference =>
  ({ position_group, distance_m, accelerations, hi_distance_m, ref_minutes: 70 })
const ref = {
  refs: new Map([['Pilier', refRow('Pilier', 4970, 15, 10)], ['Centre', refRow('Centre', 6510, 30, 60)]]),
  positions: new Map([['PILIER', 'Pilier'], ['CENTRE', 'Centre']]),
}
const players = [
  { id: 'a', first_name: 'Paul', last_name: 'MARTIN' }, { id: 'b', first_name: 'Léo', last_name: 'DUPONT' }, { id: 'c', first_name: 'Hugo', last_name: 'BERNARD' },
]
const matches = [
  { id: 'm1', match_date: '2026-10-17', opponent: 'R92', label: 'J3' }, { id: 'm2', match_date: '2026-10-24', opponent: 'USON', label: 'J4' },
]
const gps = (match_id: string, player_id: string, position: string, minutes: number, distance_m: number, hi_distance_m: number, accelerations: number, vmax: number | null): GpsRecord =>
  ({ match_id, player_id, position, minutes, distance_m, hi_distance_m, accelerations, vmax })
const records = [
  gps('m1', 'a', 'PILIER', 70, 4970, 10, 15, 27),       // 3/3
  gps('m1', 'b', 'CENTRE', 70, 6510, 30, 15, 30),       // distance seule : 1/3
  gps('m2', 'a', 'PILIER', 70, 4000, 12, 10, 28),       // HI seule : 1/3, record Vmax
  gps('m2', 'b', 'CENTRE', 15, 2000, 10, 5, 29),        // < 20 min : pas d'analyse
]
const ratings = [
  { match_id: 'm1', player_id: 'a', rater: 'player' as const, color: 'bleu' as const },
  { match_id: 'm1', player_id: 'a', rater: 'staff' as const, color: 'bleu' as const },
  { match_id: 'm1', player_id: 'b', rater: 'player' as const, color: 'vert' as const },
  { match_id: 'm1', player_id: 'b', rater: 'staff' as const, color: 'jaune' as const },
  { match_id: 'm1', player_id: 'c', rater: 'player' as const, color: 'jaune' as const }, // sans GPS : noté quand même
]

describe('matchReport : rendu équipe d\'un match', () => {
  const r = matchReport({ match: matches[0], players, records, ratings, ref, allRecords: records, matches })
  it('tous les joueurs, ceux sans GPS compris, triés par attendus remplis', () => {
    expect(r.rows.map(x => [x.player.id, x.analysis?.filled ?? null, x.own, x.staff])).toEqual([
      ['a', 3, 'bleu', 'bleu'], ['b', 1, 'vert', 'jaune'], ['c', null, 'jaune', null],
    ])
    expect(r.withGps).toBe(2)
  })
  it('couleurs GPS, notes joueurs et staff comptées ; accord joueur / staff', () => {
    expect(r.gpsColors).toEqual({ rouge: 0, jaune: 1, vert: 0, bleu: 1 })
    expect(r.ownColors).toEqual({ rouge: 0, jaune: 1, vert: 1, bleu: 1 })
    expect(r).toMatchObject({ agreement: 1, bothRated: 2 })
  })
  it('moyennes par groupe de poste', () => {
    expect(r.groups).toEqual([
      { group: 'Pilier', players: 1, distance: 100, hi: 100, accelerations: 100, filled: 3 },
      { group: 'Centre', players: 1, distance: 100, hi: 50, accelerations: 50, filled: 1 },
    ])
  })
})

describe('playerReport : bilan individuel sur un bloc de matchs', () => {
  it('historique, moyennes, attendus remplis, couleur du bloc, axe de travail, record Vmax', () => {
    const r = playerReport({ player: players[0], matches: [...matches].reverse(), records, ratings, ref })
    expect(r.history.map(h => [h.match.id, h.analysis?.filled, h.vmax?.record, h.own])).toEqual([['m1', 3, false, 'bleu'], ['m2', 1, true, null]])
    expect(r).toMatchObject({ played: 2, analysed: 2, minutes: 70, distance: 4485, vmaxMax: 28, filled: 4, possible: 6, meanFilled: 2, color: 'vert' })
    expect(r.pcts).toEqual({ distance: 90, hi: 110, accelerations: 84 }) // (100 + 67) / 2 = 83,5 → 84
    expect(r.axis).toBe('Accélérations')
  })
  it('matchs < 20 min : comptés comme joués, pas dans les attendus', () => {
    const r = playerReport({ player: players[1], matches, records, ratings, ref })
    expect(r).toMatchObject({ played: 2, analysed: 1, filled: 1, possible: 3, color: 'jaune' })
  })
  it('aucun GPS : rien à moyenner, pas de couleur ni d\'axe ; les notes restent', () => {
    const r = playerReport({ player: players[2], matches, records, ratings, ref })
    expect(r).toMatchObject({ played: 0, minutes: null, vmaxMax: null, color: null, axis: null, meanFilled: null })
    expect(r.history[0].own).toBe('jaune')
  })
})

describe('teamBlockReport : rendu collectif sur un bloc de matchs', () => {
  const r = teamBlockReport({ matches: [...matches].reverse(), players, records, ratings, ref })
  it('chaque joueur avec son bilan du bloc, triés par attendus remplis ; sans GPS en fin', () => {
    expect(r.players.map(p => [p.player.id, p.report.meanFilled, p.report.color, p.group])).toEqual([
      ['a', 2, 'vert', 'Pilier'], ['b', 1, 'jaune', 'Centre'], ['c', null, null, null],
    ])
    expect(r.matches.map(m => m.id)).toEqual(['m1', 'm2'])
  })
  it('couleurs du bloc, attendus remplis de l\'équipe, moyennes par groupe de poste', () => {
    expect(r.blockColors).toEqual({ rouge: 0, jaune: 1, vert: 1, bleu: 0 })
    expect(r).toMatchObject({ withGps: 2, filled: 5, possible: 9 })
    expect(r.groups).toEqual([
      { group: 'Pilier', players: 1, distance: 90, hi: 110, accelerations: 84, filled: 2 },
      { group: 'Centre', players: 1, distance: 100, hi: 50, accelerations: 50, filled: 1 },
    ])
  })
})

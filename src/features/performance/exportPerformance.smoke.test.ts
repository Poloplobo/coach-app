// Test « fumée » : génère réellement les .pptx Performance sous Node et inspecte le zip (diapos, graphiques).
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { downloadMatchReport, downloadPlayerReport, downloadTeamBlockReport } from './exportPerformance'
import type { GpsRecord, GpsReference } from './gps'
import { matchReport, playerReport, teamBlockReport } from './report'

const ref = {
  refs: new Map<string, GpsReference>([['Pilier', { position_group: 'Pilier', distance_m: 4970, accelerations: 15, hi_distance_m: 10, ref_minutes: 70 }]]),
  positions: new Map([['PILIER', 'Pilier']]),
}
const players = [{ id: 'a', first_name: 'Alpha', last_name: 'FICTIF' }, { id: 'b', first_name: 'Bravo', last_name: 'FICTIF' }]
const matches = [{ id: 'm1', match_date: '2026-10-17', opponent: 'R92', label: 'J3' }, { id: 'm2', match_date: '2026-10-24', opponent: 'USON', label: 'J4' }]
const g = (match_id: string, player_id: string, minutes: number, distance_m: number): GpsRecord =>
  ({ match_id, player_id, position: 'PILIER', minutes, distance_m, hi_distance_m: 12, accelerations: 14, vmax: 26 })
const records = [g('m1', 'a', 70, 5000), g('m2', 'a', 60, 4300), g('m1', 'b', 15, 1200)]
const ratings = [{ match_id: 'm1', player_id: 'a', rater: 'player' as const, color: 'vert' as const }, { match_id: 'm1', player_id: 'a', rater: 'staff' as const, color: 'vert' as const }]

let dir: string
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'rugby-perf-')) })
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })
const open = async (file: string) => {
  const zip = await JSZip.loadAsync(await readFile(file))
  const names = Object.keys(zip.files)
  return { slides: names.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length, charts: names.filter(n => /^ppt\/charts\/chart\d+\.xml$/.test(n)).length }
}

describe('PowerPoint Performance', () => {
  it('rendu collectif d\'un match : 1 diapo, 1 graphique (répartition des couleurs GPS)', async () => {
    const r = matchReport({ match: matches[0], players, records, ratings, ref, allRecords: records, matches })
    const file = join(dir, 'match.pptx')
    await downloadMatchReport(r, matches[0], file)
    expect(await open(file)).toEqual({ slides: 1, charts: 1 })
  })
  it('rendu collectif d\'un bloc : 1 diapo, 1 graphique (répartition des couleurs de bloc)', async () => {
    const r = teamBlockReport({ matches, players, records, ratings, ref })
    const file = join(dir, 'bloc-equipe.pptx')
    await downloadTeamBlockReport(r, file)
    expect(await open(file)).toEqual({ slides: 1, charts: 1 })
  })
  it('bilan individuel d\'un bloc : 1 diapo, 1 graphique (évolution, 2 matchs analysés)', async () => {
    const r = playerReport({ player: players[0], matches, records, ratings, ref })
    const file = join(dir, 'joueur.pptx')
    await downloadPlayerReport(r, players[0], '2 matchs', file)
    expect(await open(file)).toEqual({ slides: 1, charts: 1 })
  })
  it('joueur sans match analysé : 1 diapo, sans graphique d\'évolution', async () => {
    const r = playerReport({ player: players[1], matches, records, ratings, ref })
    const file = join(dir, 'joueur-vide.pptx')
    await downloadPlayerReport(r, players[1], '2 matchs', file)
    expect(await open(file)).toEqual({ slides: 1, charts: 0 })
  })
  it('avec la photo du joueur : l\'image est intégrée au fichier (et rien d\'autre ne change)', async () => {
    // PNG 1 × 1 pixel : suffit à vérifier que la photo est embarquée dans le .pptx
    const photo = 'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const r = playerReport({ player: players[0], matches: [matches[0]], records, ratings, ref })
    const file = join(dir, 'joueur-photo.pptx')
    await downloadPlayerReport(r, players[0], '1 match', file, photo)
    const zip = await JSZip.loadAsync(await readFile(file))
    expect(Object.keys(zip.files).some(n => /^ppt\/media\/image.*\.png$/.test(n))).toBe(true)
    expect(await open(file)).toEqual({ slides: 1, charts: 0 })
  })
  it('rendu individuel d\'un seul match : 1 diapo, pas de courbe (chiffres du match en tuiles)', async () => {
    const r = playerReport({ player: players[0], matches: [matches[0]], records, ratings, ref })
    const file = join(dir, 'joueur-match.pptx')
    await downloadPlayerReport(r, players[0], '1 match', file)
    expect(await open(file)).toEqual({ slides: 1, charts: 0 })
  })
})

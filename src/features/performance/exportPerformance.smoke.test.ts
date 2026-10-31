// Test « fumée » : génère réellement les .pptx Performance sous Node et inspecte le zip (diapos, graphiques).
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { downloadMatchReport, downloadPlayerReport } from './exportPerformance'
import type { GpsRecord, GpsReference } from './gps'
import { matchReport, playerReport } from './report'

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
  it('rendu équipe d\'un match : 4 diapos, 2 graphiques (groupes de poste, trois regards)', async () => {
    const r = matchReport({ match: matches[0], players, records, ratings, ref, allRecords: records, matches })
    const file = join(dir, 'match.pptx')
    await downloadMatchReport(r, matches[0], file)
    expect(await open(file)).toEqual({ slides: 4, charts: 2 })
  })
  it('bilan individuel : 4 diapos, 1 graphique (évolution, 2 matchs analysés)', async () => {
    const r = playerReport({ player: players[0], matches, records, ratings, ref })
    const file = join(dir, 'joueur.pptx')
    await downloadPlayerReport(r, players[0], '2 matchs', file)
    expect(await open(file)).toEqual({ slides: 4, charts: 1 })
  })
  it('joueur sans match analysé : diapos générées, sans graphique d\'évolution', async () => {
    const r = playerReport({ player: players[1], matches, records, ratings, ref })
    const file = join(dir, 'joueur-vide.pptx')
    await downloadPlayerReport(r, players[1], '2 matchs', file)
    expect(await open(file)).toEqual({ slides: 4, charts: 0 })
  })
})

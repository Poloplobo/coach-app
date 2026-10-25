// Test « fumée » : génère réellement les .pptx sous Node (pptxgenjs écrit sur disque via fs) et inspecte le zip.
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { downloadCycleReport, downloadWeekReport } from './exportPptx'
import { cycleReport, weekReport } from './report'
import type { ActivityType, Log, Player, WeekType } from './load'
import type { StaffMuscuSession } from './muscu'

const wt: WeekType = { code: 'DEV', name: 'Développement', target_srpe: 3000, srpe_min: 2500, srpe_max: null, volume_min: 600, physique_min: 200, rugby_min: 300, accompagnement_min: 50, ppid_min: 50 }
const players: Player[] = [
  { id: 'p', first_name: 'Alpha', last_name: 'FICTIF', position: null, injured: false },
  { id: 'q', first_name: 'Bravo', last_name: 'FICTIF', position: null, injured: true },
]
const types: ActivityType[] = [{ id: 'm', name: 'Musculation', pillar: 'physique', requires_rpe: true }, { id: 'r', name: 'Collectif', pillar: 'rugby', requires_rpe: true }]
const log = (player_id: string, session_date: string, activity_type_id: string, srpe: number): Log =>
  ({ player_id, session_date, activity_type_id, duration_min: 60, rpe: 7, srpe, source: 'app', created_at: '' })
const logs = [log('p', '2026-10-26', 'm', 420), log('p', '2026-10-27', 'r', 2400), log('q', '2026-10-26', 'm', 300)]
const week = { code: 'S7', label: null, start_date: '2026-10-26', week_type_code: 'DEV', cycle: 'Cycle 2' }
const ex = (id: string, name: string, done: string) => ({
  id, position: 1, block_label: 'A1', sets: 5, reps: '3', load_value: null, load_unit: 'free', tempo: null, rest: null, instructions: null,
  exercises: { name }, exercise_feedback: [{ player_id: 'p', rpe: 8, done_load: done, status: 'fait', comment: null }],
})
const sessions: StaffMuscuSession[] = ['2026-10-26', '2026-11-02'].map((d, i) => ({
  id: `s${i}`, session_date: d, player_id: 'p', planned_exercises: [ex('a', 'Back Squat', `3x${100 + 10 * i}`), ex('b', 'Développé Couché', `3x${80 + 5 * i}`)],
}))

let dir: string
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'rugby-pptx-')) })
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })

async function open(file: string) {
  expect((await stat(file)).size).toBeGreaterThan(0)
  const zip = await JSZip.loadAsync(await readFile(file))
  const names = Object.keys(zip.files)
  return {
    slides: names.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length,
    charts: names.filter(n => /^ppt\/charts\/chart\d+\.xml$/.test(n)).length,
  }
}

describe('export PowerPoint (fichier réel)', () => {
  it('bilan de cycle : 5 diapos, 4 graphiques (objectifs, courbes, plus gros, charge)', async () => {
    const r = cycleReport({ player: players[0], weeks: [week], weekTypes: [wt], sessions, logs, muscuTypeId: 'm',
      targets: [{ test: 'Back Squat 1RM', value: 150, label: '1RM', exercise: 'Back Squat' }] })
    const file = join(dir, 'cycle.pptx')
    await downloadCycleReport(r, file)
    expect(await open(file)).toEqual({ slides: 5, charts: 4 })
  })
  it('bilan de cycle sans objectif ni charge : 5 diapos, un seul graphique (charge hebdo)', async () => {
    const r = cycleReport({ player: players[0], weeks: [week], weekTypes: [wt], sessions: [], logs: [], muscuTypeId: 'm', targets: [] })
    const file = join(dir, 'cycle-vide.pptx')
    await downloadCycleReport(r, file)
    expect(await open(file)).toEqual({ slides: 5, charts: 1 })
  })
  it('résumé collectif : 5 diapos, 4 graphiques (joueurs, jours, piliers) + tableau', async () => {
    const r = weekReport({ week, wt, players, logs, inProgress: false })
    const file = join(dir, 'semaine.pptx')
    await downloadWeekReport(r, week, wt, logs, types, file)
    expect(await open(file)).toEqual({ slides: 5, charts: 3 })
  })
  it('résumé collectif sans type de semaine ni log', async () => {
    const r = weekReport({ week, wt: null, players, logs: [], inProgress: true })
    const file = join(dir, 'semaine-vide.pptx')
    await downloadWeekReport(r, week, null, [], types, file)
    // sans activité, pas d'anneau de répartition vide : un message à la place
    expect(await open(file)).toEqual({ slides: 5, charts: 2 })
  })
})

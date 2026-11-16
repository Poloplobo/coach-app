import { describe, expect, it } from 'vitest'
import type { Log, Player, WeekType } from './load'
import { blockSummary, blocksOf, chosenBlock, coachSummary, comparisonBlock, injuriesIn, previousBlock, weeklyLoad, wellnessSummary, type Week } from './summary'

const wt = (code: string, target: number, min: number | null, max: number | null): WeekType =>
  ({ code, name: code, target_srpe: target, srpe_min: min, srpe_max: max, volume_min: 0, physique_min: 0, rugby_min: 0, accompagnement_min: 0, ppid_min: 0 })
const TYPES = [wt('COMP', 2000, 1500, 2500), wt('REG', 1000, 500, 1500), wt('DEV', 3000, 2500, null)]
const week = (code: string, start_date: string, week_type_code: string, cycle: string, block: number | null): Week => ({ code, label: null, start_date, week_type_code, cycle, block })
const WEEKS = [week('S1', '2026-10-05', 'COMP', 'Cycle 1', 1), week('S2', '2026-10-12', 'REG', 'Cycle 1', 1),
  week('S3', '2026-10-19', 'DEV', 'Cycle 1', 2), week('S4', '2026-10-26', 'COMP', 'Cycle 2', 3), week('S5', '2026-11-02', 'COMP', 'Cycle 2', null)]
const log = (player_id: string, session_date: string, srpe: number, activity_type_id = 'rugby'): Log =>
  ({ player_id, session_date, activity_type_id, duration_min: 60, rpe: 5, srpe, source: 'app', created_at: '' })
const player = (id: string): Player => ({ id, first_name: 'Léo', last_name: id.toUpperCase(), position: null, injured: false })
const EMPTY = { weekTypes: TYPES, wellness: [], muscu: [], muscuTypeId: 'muscu', matches: [], gps: [], ratings: [], gpsRef: { refs: new Map(), positions: new Map() }, injuries: [] }

describe('blocksOf', () => {
  it('regroupe les semaines par numéro de bloc, avec le rang dans le cycle ; semaine sans bloc ignorée', () => {
    const b = blocksOf(WEEKS)
    expect(b.map(x => [x.block, x.cycle, x.rank, x.weeks.map(w => w.code).join(''), x.from, x.to])).toEqual([
      [1, 'Cycle 1', 1, 'S1S2', '2026-10-05', '2026-10-18'], [2, 'Cycle 1', 2, 'S3', '2026-10-19', '2026-10-25'], [3, 'Cycle 2', 1, 'S4', '2026-10-26', '2026-11-01']])
  })
})

describe('weeklyLoad', () => {
  it('statut des semaines terminées, pas de statut en cours ni à venir', () => {
    const w = weeklyLoad(WEEKS, TYPES, [log('a', '2026-10-06', 2000), log('a', '2026-10-13', 300), log('a', '2026-10-20', 900)], '2026-10-21')
    expect(w.map(x => [x.code, x.total, x.status, x.inProgress, x.future])).toEqual([
      ['S1', 2000, 'conforme', false, false], ['S2', 300, 'sous-charge', false, false], ['S3', 900, null, true, false],
      ['S4', 0, null, false, true], ['S5', 0, null, false, true]])
  })
})

describe('blockSummary', () => {
  const [b1, b2] = blocksOf(WEEKS)
  it('joueur sans aucune donnée : rien ne plante, tout est vide', () => {
    const r = blockSummary({ ...EMPTY, player: player('a'), logs: [], block: b1, today: '2026-11-10' })
    expect(r.total).toBe(0)
    expect(r.changePct).toBeNull()
    expect(r.wellness.fatigue).toBeNull()
    expect(r.muscu.rate).toBeNull()
    expect(r.gps.played).toBe(0)
    expect(r.highlights.length).toBeGreaterThan(0)
  })
  it('évolution face au bloc précédent, repos face aux semaines de match, synthèse', () => {
    const logs = [log('a', '2026-10-06', 2000), log('a', '2026-10-13', 1000), log('a', '2026-10-20', 3600)]
    const first = blockSummary({ ...EMPTY, player: player('a'), logs, block: b1, today: '2026-11-10' })
    expect([first.total, first.work, first.rest]).toEqual([3000, 2000, 1000])
    const second = blockSummary({ ...EMPTY, player: player('a'), logs, block: b2, previous: b1, today: '2026-11-10' })
    // 3600 UA sur 1 semaine contre 3000 UA sur 2 semaines : la moyenne par semaine passe de 1500 à 3600
    expect([second.perWeek, second.previousPerWeek, second.changePct]).toEqual([3600, 1500, 140])
    expect([second.total, second.previousTotal, second.totalChangePct]).toEqual([3600, 3000, 20])
    expect(second.highlights[0]).toBe('Charge moyenne par semaine en hausse de 140 % par rapport au bloc 1.')
  })
  it('bloc en cours : exportable, sans statut sur la semaine non terminée', () => {
    const r = blockSummary({ ...EMPTY, player: player('a'), logs: [log('a', '2026-10-06', 2000)], block: b1, today: '2026-10-14' })
    expect(r.inProgress).toBe(true)
    expect(r.weekly[1].status).toBeNull()
  })
})

describe('semaines choisies à la main', () => {
  const numbered = blocksOf(WEEKS)
  it("les semaines d'un bloc numéroté redonnent ce bloc ; sinon un bloc nommé par ses semaines", () => {
    expect(chosenBlock([WEEKS[1], WEEKS[0]], numbered).block).toBe(1)
    expect(chosenBlock([WEEKS[2], WEEKS[1]], numbered)).toMatchObject({ label: 'S2 → S3', from: '2026-10-12', to: '2026-10-25' })
    expect(chosenBlock([WEEKS[0], WEEKS[2]], numbered).label).toBe('S1, S3')
  })
  it('comparaison : autant de semaines juste avant, et seules les semaines choisies comptent', () => {
    const block = chosenBlock([WEEKS[2], WEEKS[3]], numbered)
    const previous = comparisonBlock(block, numbered, WEEKS)
    expect(previous).toMatchObject({ label: 'S1 → S2', from: '2026-10-05', to: '2026-10-18' })
    expect(comparisonBlock(chosenBlock([WEEKS[0], WEEKS[2]], numbered), numbered, WEEKS)).toBeNull()
    expect(comparisonBlock(chosenBlock([WEEKS[1], WEEKS[2], WEEKS[3]], []), [], WEEKS)).toBeNull() // une seule semaine avant, pour trois choisies
    const logs = [log('a', '2026-10-06', 1000), log('a', '2026-10-13', 1000), log('a', '2026-10-20', 3000), log('a', '2026-10-27', 3000)]
    const r = blockSummary({ ...EMPTY, player: player('a'), logs, block, previous, today: '2026-11-10' })
    expect([r.total, r.previousTotal, r.totalChangePct]).toEqual([6000, 2000, 200])
    expect(r.highlights[0]).toBe('Charge moyenne par semaine en hausse de 200 % par rapport à la période S1 → S2.')
    expect(blockSummary({ ...EMPTY, player: player('a'), logs, block: chosenBlock([WEEKS[0], WEEKS[2]], numbered), today: '2026-11-10' }).total).toBe(4000)
  })
})

describe('blocs mal numérotés', () => {
  it('bloc non contigu : seules ses semaines comptent ; bloc précédent par position, pas par numéro', () => {
    const weeks = [week('S1', '2026-10-05', 'COMP', 'C', 1), week('S2', '2026-10-12', 'COMP', 'C', 2), week('S3', '2026-10-19', 'COMP', 'C', 1), week('S4', '2026-10-26', 'COMP', 'C', 4)]
    const blocks = blocksOf(weeks)
    const logs = [log('a', '2026-10-06', 2000), log('a', '2026-10-13', 2000), log('a', '2026-10-20', 2000)]
    expect(blockSummary({ ...EMPTY, player: player('a'), logs, block: blocks[0], today: '2026-11-10' }).total).toBe(4000)
    expect(previousBlock(blocks, blocks[2])?.block).toBe(2)
    expect(previousBlock(blocks, blocks[0])).toBeNull()
  })
})

describe('wellnessSummary et injuriesIn', () => {
  it('alertes (score < 16 ou item à 1) et zones concernées', () => {
    const e = (entry_date: string, score: number, soreness_lower: number) => ({ player_id: 'a', entry_date, score, sleep_quality: 3, fatigue: 3, soreness_upper: 3, soreness_lower, stress: 3, mood: 3 })
    const r = wellnessSummary([e('2026-10-06', 24, 4), e('2026-10-07', 20, 1), e('2026-10-08', 14, 1)])
    expect(r.alerts.map(a => a.date)).toEqual(['2026-10-07', '2026-10-08'])
    expect(r.zones).toEqual([{ label: 'Courbatures bas du corps', count: 2 }])
  })
  it('blessure qui touche la période, jours d\'arrêt comptés jusqu\'à aujourd\'hui si elle est en cours', () => {
    const injury = { id: 'i', player_id: 'a', occurred_on: '2026-10-01', ended_on: null, location: 'cuisse', tissue: 'muscle_tendon', mechanism: 'sans_contact', onset: null, activity: 'match', recurrence: false, alerts: {} }
    const r = injuriesIn([injury, { ...injury, id: 'j', occurred_on: '2026-08-01', ended_on: '2026-08-20' }], '2026-10-05', '2026-10-18', '2026-10-11')
    expect(r).toHaveLength(1)
    // survenue 4 jours avant la période : 10 jours d'arrêt en tout, 6 dans la période
    expect(r[0]).toMatchObject({ what: 'Cuisse · Muscle / tendon', context: 'Match · Sans contact (course, appui…)', days: 10, daysIn: 6, ongoing: true })
  })
})

describe('coachSummary', () => {
  it('moyenne équipe par semaine, joueurs hors plage, couleur de la ligne', () => {
    const logs = [log('a', '2026-10-06', 2000), log('a', '2026-10-13', 1000), log('b', '2026-10-06', 3000), log('b', '2026-10-13', 2000)]
    const r = coachSummary({ ...EMPTY, players: [player('a'), player('b')], weeks: WEEKS.slice(0, 2), logs, plan: [], skips: [], types: [], withRatio: false, today: '2026-11-10' })
    expect(r.team.map(w => [w.code, w.total, w.status, w.over])).toEqual([['S1', 2500, 'conforme', ['B Léo']], ['S2', 1500, 'conforme', ['B Léo']]])
    expect(r.rows.map(x => [x.player.id, x.total, x.over, x.tones.load, x.worst, x.ratio])).toEqual([['a', 3000, 0, 'ok', 'ok', null], ['b', 5000, 2, 'bad', 'bad', null]])
    expect(r.attendance).toBeNull()
    // aucun état de forme rempli : alertes non renseignées, pas « 0 » en vert
    expect(r.rows.map(x => [x.alerts, x.tones.alerts])).toEqual([[null, 'neutral'], [null, 'neutral']])
  })
})

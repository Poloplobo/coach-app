import { describe, expect, it } from 'vitest'
import {
  acwr, hotSessions, overLoad, plannedLoad, rpeGap, rpeMatrix, rpeVsTarget, targetRpe, dailySynthesis, latecomers, weekPace, loadStatus, pctOfTarget, pillarSplit, playerDays, reminderMessage, weekMatrix, wellnessAlerts,
  type ActivityType, type Log, type Player, type WeekType,
} from './load'

const DEV: WeekType = { code: 'DEV', name: 'Semaine Développement', target_srpe: 3000, srpe_min: 2500, srpe_max: null,
  volume_min: 720, physique_min: 300, rugby_min: 120, accompagnement_min: 120, ppid_min: 180 }
const COMP = { srpe_min: 1500, srpe_max: 2500 }
const REG = { srpe_min: 500, srpe_max: 1500 }

const types: ActivityType[] = [
  { id: 'muscu', name: 'Musculation', pillar: 'physique', requires_rpe: true },
  { id: 'poste', name: 'Jeu au Poste', pillar: 'rugby', requires_rpe: true },
  { id: 'video', name: 'Vidéo', pillar: 'accompagnement', requires_rpe: false },
]
const player = (id: string, injured = false): Player => ({ id, first_name: `P${id}`, last_name: 'TEST', position: null, injured })
const log = (player_id: string, session_date: string, activity_type_id: string, duration_min: number, rpe: number | null): Log =>
  ({ player_id, session_date, activity_type_id, duration_min, rpe, srpe: (rpe ?? 0) * duration_min, source: 'app', created_at: `${session_date}T20:00:00Z` })

describe('loadStatus : plages du type de semaine', () => {
  it('compétition 1500-2500 : bornes incluses', () => {
    expect([1499, 1500, 2500, 2501].map(v => loadStatus(v, COMP))).toEqual(['sous-charge', 'conforme', 'conforme', 'surcharge'])
  })
  it('régénération 500-1500', () => {
    expect([499, 500, 1500, 1501].map(v => loadStatus(v, REG))).toEqual(['sous-charge', 'conforme', 'conforme', 'surcharge'])
  })
  it('développement > 2500 : jamais en surcharge', () => {
    expect([2499, 2500, 9000].map(v => loadStatus(v, DEV))).toEqual(['sous-charge', 'conforme', 'conforme'])
  })
  it('semaine hors calendrier : pas de statut', () => {
    expect(loadStatus(1000, null)).toBeNull()
  })
})

it('pctOfTarget : % de la cible à une décimale (« Accurate RPE »)', () => {
  expect(pctOfTarget(2430, 3000)).toBe(81)
  expect(pctOfTarget(1550, 3000)).toBe(51.7)
  expect(pctOfTarget(100, 0)).toBe(0)
})

describe('weekMatrix', () => {
  const week = '2026-10-05'
  const logs = [
    log('a', '2026-10-05', 'muscu', 60, 5), log('a', '2026-10-05', 'poste', 30, 4), // lundi 420
    log('a', '2026-10-07', 'muscu', 60, 10),                                       // mercredi 600 → total 1020
    log('b', '2026-10-05', 'muscu', 60, 5),                                        // 300
    log('c', '2026-10-06', 'muscu', 60, 9),                                        // blessé : 540
  ]
  const m = weekMatrix([player('a'), player('b'), player('c', true)], logs, week, DEV)

  it('sRPE par jour, total, séances (jours déclarés), %, écart à la cible', () => {
    const a = m.rows[0]
    expect(a.byDay).toEqual([420, 0, 600, 0, 0, 0, 0])
    expect(a).toMatchObject({ total: 1020, sessions: 2, minutes: 150, pct: 34, gap: -1980, status: 'sous-charge' })
  })
  it('moyenne du groupe et écart au groupe calculés sans le joueur blessé', () => {
    expect(m.groupMean).toBe(660) // (1020 + 300) / 2
    expect(m.rows[0].vsGroupPct).toBe(54.5)
    expect(m.rows[1].vsGroupPct).toBe(-54.5)
  })
  it('anomalies : hors plage, blessé exclu', () => {
    expect(m.anomalies.map(r => r.player.id)).toEqual(['a', 'b'])
  })
  it('semaine en cours : % atteint, mais ni statut ni anomalie', () => {
    const live = weekMatrix([player('a'), player('b')], logs, week, DEV, { inProgress: true })
    expect(live.rows[0]).toMatchObject({ total: 1020, pct: 34, status: null })
    expect(live).toMatchObject({ groupStatus: null, anomalies: [], inProgress: true })
  })
  it('moyenne du jour parmi les déclarants aptes', () => {
    expect(m.dayMeans.slice(0, 3)).toEqual([360, 0, 600])
  })
})

it('dailySynthesis : déclarants, minutes moyennes par pilier, sRPE moyen et cumulé, intensité', () => {
  const s = dailySynthesis([log('a', '2026-10-05', 'muscu', 60, 5), log('a', '2026-10-05', 'poste', 30, 4), log('b', '2026-10-05', 'muscu', 60, 5)], types, '2026-10-05')
  expect(s[0]).toMatchObject({ day: 'Lundi', declarants: 2, avgMinutes: 75, rugbyMinutes: 15, physiqueMinutes: 60, avgSrpe: 360, cumulSrpe: 720, intensity: 4.8 })
  expect(s[1]).toMatchObject({ declarants: 0, avgSrpe: 0, intensity: 0 })
})

it('pillarSplit : minutes moyennes par joueur et % vs préconisation du type de semaine', () => {
  const split = pillarSplit([log('a', '2026-10-05', 'muscu', 60, 5), log('a', '2026-10-05', 'video', 40, null)], types, DEV)
  expect(split.find(p => p.pillar === 'physique')).toEqual({ pillar: 'physique', minutes: 60, pct: 60, targetPct: 41.7, gap: 18.3 })
  expect(split.find(p => p.pillar === 'ppid')).toMatchObject({ minutes: 0, pct: 0, targetPct: 25 })
})

it('playerDays : activités du jour, minutes par pilier, RPE moyen, écart à la moyenne du groupe', () => {
  const d = playerDays([log('a', '2026-10-05', 'muscu', 60, 5), log('a', '2026-10-05', 'video', 30, null)], types, '2026-10-05', [200, 0, 0, 0, 0, 0, 0])
  expect(d[0]).toEqual({ day: 'Lundi', date: '2026-10-05', activities: 'Musculation (60m) + Vidéo (30m)', minutes: 90,
    rugby: 0, physique: 60, accompagnement: 30, avgRpe: 5, srpe: 300, groupMean: 200, gap: 100 })
  expect(d[1].avgRpe).toBeNull()
})

describe('acwr : aigu 7 j / moyenne hebdo 28 j', () => {
  const day = (offset: number) => new Date(Date.UTC(2026, 9, 24 - offset)).toISOString().slice(0, 10)
  it('charge régulière : ratio 1, zone optimale', () => {
    const logs = Array.from({ length: 28 }, (_, i) => log('a', day(i), 'muscu', 60, 5)) // 300 UA / jour
    expect(acwr(logs, '2026-10-24')).toEqual({ acute: 2100, chronic: 2100, ratio: 1, zone: 'optimal' })
  })
  it('pic sur la dernière semaine après 3 semaines très légères : zone de risque', () => {
    const logs = [log('a', day(27), 'muscu', 100, 1), ...Array.from({ length: 7 }, (_, i) => log('a', day(i), 'muscu', 60, 10))]
    expect(acwr(logs, '2026-10-24')).toMatchObject({ acute: 4200, chronic: 1075, ratio: 3.91, zone: 'risque' })
  })
  it('moins de 28 jours d\'historique : pas de ratio (sinon faux « risque »)', () => {
    const logs = Array.from({ length: 7 }, (_, i) => log('a', day(i), 'muscu', 60, 5)) // nouveau joueur, 1 semaine
    expect(acwr(logs, '2026-10-24')).toMatchObject({ acute: 2100, ratio: null, zone: null })
  })
  it('seuils : < 0,8 bas, ≤ 1,3 optimal, ≤ 1,5 vigilance', () => {
    const zone = (acute: number) => acwr([log('a', '2026-09-27', 'muscu', 100, 4), log('a', '2026-10-24', 'muscu', acute, 1)], '2026-10-24').zone
    // chronique = (400 + aigu) / 4 ; on choisit l'aigu pour viser chaque zone
    expect(zone(50)).toBe('bas')        // 50 / 113 = 0,44
    expect(zone(130)).toBe('optimal')   // 130 / 133 = 0,98
    expect(zone(215)).toBe('vigilance') // 215 / 154 = 1,40
    expect(zone(800)).toBe('risque')    // 800 / 300 = 2,67
  })
  it('aucun historique : pas de ratio', () => {
    expect(acwr([], '2026-10-24')).toEqual({ acute: 0, chronic: 0, ratio: null, zone: null })
  })
})

describe('wellnessAlerts', () => {
  const w = (over: Record<string, number>) => ({ sleep_quality: 3, fatigue: 3, soreness_upper: 3, soreness_lower: 3, stress: 3, mood: 3, score: 18, ...over })
  it('score sous 16/30 ou item à 1', () => {
    expect(wellnessAlerts(w({ score: 15 }))).toEqual(['Score 15/30'])
    expect(wellnessAlerts(w({ soreness_lower: 1, score: 16 }))).toEqual(['Courbatures bas du corps à 1'])
    expect(wellnessAlerts(w({}))).toEqual([])
  })
})

describe('latecomers', () => {
  const today = '2026-10-27'
  const plan = [{ player_id: null, session_date: '2026-10-26', activity_type_id: 'poste' }]
  it('forme du jour non remplie, RPE de la veille manquant alors que le groupe s\'entraînait', () => {
    const late = latecomers([player('a'), player('b')], [{ player_id: 'b' }], plan, [{ player_id: 'b', session_date: '2026-10-26', activity_type_id: 'poste' }], today)
    expect(late.map(l => [l.player.id, l.missing])).toEqual([['a', ['état de forme du jour', "RPE d'hier"]]])
  })
  it('veille partielle : une activité prévue non déclarée ou une muscu non validée relance', () => {
    const day = '2026-10-26'
    const both = [{ player_id: null, session_date: day, activity_type_id: 'poste' }, { player_id: 'a', session_date: day, activity_type_id: 'muscu', activity_types: { name: 'Musculation' } }]
    const w = [{ player_id: 'a' }]
    expect(latecomers([player('a')], w, both, [{ player_id: 'a', session_date: day, activity_type_id: 'poste' }], today)[0]?.missing).toEqual(["RPE d'hier"])
    expect(latecomers([player('a')], w, both, [{ player_id: 'a', session_date: day, activity_type_id: 'poste' }, { player_id: 'a', session_date: day, activity_type_id: 'muscu', validated_at: null }], today)[0]?.missing).toEqual(["RPE d'hier"])
    expect(latecomers([player('a')], w, both, [{ player_id: 'a', session_date: day, activity_type_id: 'poste' }, { player_id: 'a', session_date: day, activity_type_id: 'muscu', validated_at: '2026-10-26T19:00:00Z' }], today)).toEqual([])
  })
  it('joueur blessé : pas relancé pour les séances du groupe', () => {
    expect(latecomers([player('c', true)], [{ player_id: 'c' }], plan, [], today)).toEqual([])
  })
  it('message de relance prêt à copier', () => {
    expect(reminderMessage(player('a'), ['état de forme du jour'])).toBe("Salut Pa, pense à remplir état de forme du jour dans l'app du Pôle. Merci !")
  })
})

it('rpeMatrix : RPE moyen par jour et sur la semaine, activités sans RPE ignorées, blessé hors moyenne du groupe', () => {
  const r = rpeMatrix([player('a'), player('b', true)], [
    log('a', '2026-10-05', 'muscu', 60, 6), log('a', '2026-10-05', 'video', 30, null), log('a', '2026-10-07', 'poste', 45, 9),
    log('b', '2026-10-05', 'muscu', 60, 2),
  ], '2026-10-05')
  expect(r.rows[0]).toMatchObject({ byDay: [6, null, 9, null, null, null, null], week: 7.5 })
  expect(r.groupByDay[0]).toBe(6)
  expect(r.groupWeek).toBe(7.5)
})

describe('seuils de charge par activité', () => {
  it('overLoad : rien sous le seuil ou sans seuil, orange au-dessus, rouge au-delà de 1,25 ×', () => {
    expect([overLoad(480, 480), overLoad(490, 480), overLoad(600, 480), overLoad(601, 480), overLoad(900, null)]).toEqual([null, 'warn', 'warn', 'bad', null])
  })
  it('hotSessions : séances au-dessus du seuil de leur activité, la plus chaude d\'abord', () => {
    const t = [{ ...types[0], max_srpe: 480 }, { ...types[1], max_srpe: 200 }, types[2]]
    const logs = [log('a', '2026-11-02', 'muscu', 70, 7), log('a', '2026-11-02', 'poste', 60, 4), log('a', '2026-11-03', 'poste', 60, 5), log('a', '2026-11-03', 'video', 20, null)]
    expect(hotSessions(logs, t).map(h => [h.name, h.srpe, h.heat])).toEqual([['Jeu au Poste', 300, 'bad'], ['Jeu au Poste', 240, 'warn'], ['Musculation', 490, 'warn']])
  })
})

describe('weekPace : rythme de la semaine selon le planning', () => {
  const plan = [
    { player_id: null, session_date: '2026-11-02', planned_duration_min: 60 },
    { player_id: null, session_date: '2026-11-03', planned_duration_min: 60 },
    { player_id: null, session_date: '2026-11-04', activity_types: { default_duration_min: 90 } },
    { player_id: 'a', session_date: '2026-11-02', planned_duration_min: 70 },
    { player_id: 'b', session_date: '2026-11-05', planned_duration_min: 500 }, // séance d'un autre joueur : ignorée
    { player_id: null, session_date: '2026-11-06', planned_duration_min: 70 },
  ]
  const COMP = { target_srpe: 2000 }
  it('part du planning passée × charge visée ; au-dessus : trop haut pour le moment de la semaine', () => {
    // a : 190 min prévues jusqu'à mardi sur 350 → 54 % → limite 1086
    expect(weekPace(player('a'), 1060, plan, '2026-11-03', COMP)).toEqual({ share: 54, limit: 1086, over: false, pct: 98 })
    expect(weekPace(player('a'), 1100, plan, '2026-11-03', COMP)?.over).toBe(true)
  })
  it('blessé : seulement ses séances individuelles ; sans type de semaine ou sans planning : rien', () => {
    expect(weekPace(player('a', true), 600, plan, '2026-11-03', COMP)).toMatchObject({ share: 100, limit: 2000 })
    expect(weekPace(player('a'), 1060, plan, '2026-11-03', null)).toBeNull()
    expect(weekPace(player('c'), 100, [], '2026-11-03', COMP)).toBeNull()
  })
})

describe('RPE visé', () => {
  const targets = [{ week_type_code: 'COMP', activity_type_id: 'poste', target_rpe: 4 }, { week_type_code: 'DEV', activity_type_id: 'poste', target_rpe: 5 }]
  const plan = [
    { player_id: null, session_date: '2026-11-03', activity_type_id: 'poste', planned_rpe: 6 },
    { player_id: null, session_date: '2026-11-02', activity_type_id: 'poste', planned_rpe: null },
  ]
  it('targetRpe : RPE de la séance s\'il est saisi, sinon celui du type de semaine, sinon rien', () => {
    expect(targetRpe({ player_id: 'a', session_date: '2026-11-03', activity_type_id: 'poste' }, plan, 'COMP', targets)).toBe(6)
    expect(targetRpe({ player_id: 'a', session_date: '2026-11-02', activity_type_id: 'poste' }, plan, 'COMP', targets)).toBe(4)
    expect(targetRpe({ player_id: 'a', session_date: '2026-11-02', activity_type_id: 'poste' }, plan, 'DEV', targets)).toBe(5)
    expect(targetRpe({ player_id: 'a', session_date: '2026-11-02', activity_type_id: 'muscu' }, plan, 'COMP', targets)).toBeNull()
  })
  it('rpeGap : orange à ±2, rouge à ±3 ; texte « RPE · visé (écart) »', () => {
    expect([rpeGap(5, 4), rpeGap(6, 4), rpeGap(2, 4), rpeGap(7.5, 4), rpeGap(5, null)]).toEqual([
      { gap: 1, heat: null }, { gap: 2, heat: 'warn' }, { gap: -2, heat: 'warn' }, { gap: 3.5, heat: 'bad' }, null])
    expect(rpeVsTarget(6, 4)).toBe('RPE 6 · visé 4 (+2)')
    expect(rpeVsTarget(3.5, 4)).toBe('RPE 3,5 · visé 4 (-0,5)')
    expect(rpeVsTarget(6, null)).toBe('RPE 6')
  })
  it('plannedLoad : Σ RPE visé × minutes', () => {
    expect(plannedLoad([{ minutes: 60, rpe: 4 }, { minutes: 30, rpe: 2.5 }, { minutes: 20, rpe: null }])).toBe(315)
  })
})

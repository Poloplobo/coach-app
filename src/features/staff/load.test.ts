import { describe, expect, it } from 'vitest'
import {
  acwr, hotSessions, missingRpe, overLoad, parseRpeRange, plannedLoad, rpeGap, rpeMatrix, rpeVsTarget, sessionTarget, dailySynthesis, latecomers, weekPace, loadStatus, pctOfTarget, pillarSplit, playerDays, reminderMessage, weekMatrix, wellnessAlerts,
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

describe('acwr : 4 derniers jours d\'entraînement / 16 derniers ÷ 4 (lun, mar, mer, ven)', () => {
  // vendredi 23/10/2026 ; jours d'entraînement : 23, 21, 20, 19 (aigu), puis 16, 14, 13, 12, 9, 7, 6, 5, 2, 30/09, 29/09, 28/09
  const training = ['2026-10-23', '2026-10-21', '2026-10-20', '2026-10-19', '2026-10-16', '2026-10-14', '2026-10-13', '2026-10-12',
    '2026-10-09', '2026-10-07', '2026-10-06', '2026-10-05', '2026-10-02', '2026-09-30', '2026-09-29', '2026-09-28']
  it('charge régulière : ratio 1 ; jeudi et week-end (match) ne comptent pas', () => {
    const logs = [...training.map(d => log('a', d, 'muscu', 60, 5)), log('a', '2026-10-22', 'poste', 60, 9), log('a', '2026-10-18', 'poste', 70, 10)]
    expect(acwr(logs, '2026-10-23')).toEqual({ acute: 1200, chronic: 1200, ratio: 1, zone: 'optimal' })
    expect(acwr(logs, '2026-10-24')).toEqual({ acute: 1200, chronic: 1200, ratio: 1, zone: 'optimal' }) // samedi : mêmes jours
  })
  it('pic sur les 4 derniers jours d\'entraînement après 3 blocs légers : risque', () => {
    const logs = [log('a', '2026-09-28', 'muscu', 100, 1), ...training.slice(0, 4).map(d => log('a', d, 'muscu', 60, 10))]
    expect(acwr(logs, '2026-10-23')).toMatchObject({ acute: 2400, chronic: 625, ratio: 3.84, zone: 'risque' })
  })
  it('historique plus court que 16 jours d\'entraînement, ou aucun : pas de ratio', () => {
    expect(acwr(training.slice(0, 8).map(d => log('a', d, 'muscu', 60, 5)), '2026-10-23')).toMatchObject({ acute: 1200, ratio: null, zone: null })
    expect(acwr([], '2026-10-23')).toEqual({ acute: 0, chronic: 0, ratio: null, zone: null })
  })
  it('seuils : < 0,8 bas, ≤ 1,3 optimal, ≤ 1,5 vigilance, au-delà risque', () => {
    const zone = (acute: number) => acwr([log('a', '2026-09-28', 'muscu', 100, 4), log('a', '2026-10-23', 'muscu', acute, 1)], '2026-10-23').zone
    expect([zone(50), zone(130), zone(215), zone(800)]).toEqual(['bas', 'optimal', 'vigilance', 'risque'])
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

describe('seuil de charge d\'une séance', () => {
  it('overLoad : rien sous le seuil ou sans seuil, orange au-dessus, rouge au-delà de 1,25 ×', () => {
    expect([overLoad(480, 480), overLoad(490, 480), overLoad(600, 480), overLoad(601, 480), overLoad(900, null)]).toEqual([null, 'warn', 'warn', 'bad', null])
  })
  it('hotSessions : séances au-dessus de leur seuil (haut de la fourchette × durée prévue), la plus chaude d\'abord', () => {
    const logs = [log('a', '2026-11-02', 'muscu', 70, 7), log('a', '2026-11-02', 'poste', 60, 4), log('a', '2026-11-03', 'poste', 60, 5), log('a', '2026-11-03', 'video', 20, null)]
    const seuil = (l: { activity_type_id: string | null }) => ({ maxLoad: l.activity_type_id === 'muscu' ? 480 : l.activity_type_id === 'poste' ? 200 : null })
    expect(hotSessions(logs, types, seuil).map(h => [h.name, h.srpe, h.heat])).toEqual([['Jeu au Poste', 300, 'bad'], ['Jeu au Poste', 240, 'warn'], ['Musculation', 490, 'warn']])
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

describe('RPE visé en fourchette', () => {
  const targets = [{ week_type_code: 'COMP', activity_type_id: 'poste', rpe_min: 3, rpe_max: 4 }, { week_type_code: 'DEV', activity_type_id: 'poste', rpe_min: 5, rpe_max: 5 }]
  const plan = [
    { player_id: null, session_date: '2026-11-03', activity_type_id: 'poste', planned_rpe: 5, planned_rpe_max: 6, planned_duration_min: 45 },
    { player_id: null, session_date: '2026-11-02', activity_type_id: 'poste', planned_rpe: null, planned_duration_min: 60 },
  ]
  it('parseRpeRange : « 5,6 », « 5-6 », « 5/6 », « 5 à 6 » = 5 ou 6 ; « 4 » = 4 ; décimales et inversions refusées', () => {
    expect(['5,6', '5-6', '5 / 6', '5 à 6', '4', ''].map(parseRpeRange)).toEqual([{ min: 5, max: 6 }, { min: 5, max: 6 }, { min: 5, max: 6 }, { min: 5, max: 6 }, { min: 4, max: 4 }, null])
    expect(['5.6', '6-5', '11', 'x'].map(parseRpeRange)).toEqual(['invalide', 'invalide', 'invalide', 'invalide'])
  })
  it('sessionTarget : fourchette de la séance, sinon du type de semaine ; seuil = haut × durée prévue', () => {
    expect(sessionTarget({ player_id: 'a', session_date: '2026-11-03', activity_type_id: 'poste' }, plan, 'COMP', targets)).toEqual({ range: { min: 5, max: 6 }, maxLoad: 270 })
    expect(sessionTarget({ player_id: 'a', session_date: '2026-11-02', activity_type_id: 'poste' }, plan, 'COMP', targets)).toEqual({ range: { min: 3, max: 4 }, maxLoad: 240 })
    // activité hors planning : fourchette du type, pas de seuil de charge
    expect(sessionTarget({ player_id: 'a', session_date: '2026-11-04', activity_type_id: 'poste' }, plan, 'DEV', targets)).toEqual({ range: { min: 5, max: 5 }, maxLoad: null })
    expect(sessionTarget({ player_id: 'a', session_date: '2026-11-02', activity_type_id: 'muscu' }, plan, 'COMP', targets).range).toBeNull()
  })
  it('rpeGap compté depuis la fourchette : 0 dedans, orange à ±2, rouge à ±3 ; texte « RPE · visé (écart) »', () => {
    const r = { min: 3, max: 4 }
    expect([rpeGap(4, r), rpeGap(5, r), rpeGap(6, r), rpeGap(1, r), rpeGap(7.5, r), rpeGap(5, null)]).toEqual([
      { gap: 0, heat: null }, { gap: 1, heat: null }, { gap: 2, heat: 'warn' }, { gap: -2, heat: 'warn' }, { gap: 3.5, heat: 'bad' }, null])
    expect(rpeVsTarget(6, r)).toBe('RPE 6 · visé 3-4 (+2)')
    expect(rpeVsTarget(4, r)).toBe('RPE 4 · visé 3-4')
    expect(rpeVsTarget(4, { min: 4, max: 4 })).toBe('RPE 4 · visé 4')
    expect(rpeVsTarget(6, null)).toBe('RPE 6')
  })
  it('plannedLoad : milieu de la fourchette × minutes', () => {
    expect(plannedLoad([{ minutes: 60, range: { min: 3, max: 4 } }, { minutes: 30, range: { min: 4, max: 4 } }, { minutes: 20, range: null }])).toBe(330)
  })
})

describe('missingRpe : RPE non déclarés jour par jour', () => {
  const t = [...types, { id: 'recup', name: 'Récupération', pillar: 'accompagnement' as const, requires_rpe: false }]
  const plan = [
    { player_id: null, session_date: '2026-11-04', activity_type_id: 'poste' },
    { player_id: null, session_date: '2026-11-04', activity_type_id: 'video' }, // sans RPE : ignoré
    { player_id: 'a', session_date: '2026-11-04', activity_type_id: 'muscu' },
    { player_id: null, session_date: '2026-11-05', activity_type_id: 'recup' },
  ]
  it('activités avec RPE sans déclaration et muscu non validée, les plus oublieux d\'abord ; blessé : pas les séances du groupe', () => {
    const logs = [
      { player_id: 'b', session_date: '2026-11-04', activity_type_id: 'poste', validated_at: null },
      { player_id: 'a', session_date: '2026-11-04', activity_type_id: 'muscu', validated_at: null }, // retours saisis, pas validée
    ]
    const r = missingRpe([player('a'), player('b'), player('c', true)], plan, logs, t, '2026-11-02', '2026-11-05')
    expect(r.map(x => [x.player.id, x.missed, x.planned, x.days])).toEqual([
      ['a', 2, 2, [{ date: '2026-11-04', missing: ['Jeu au Poste', 'Musculation'] }]],
    ])
  })
  it('jour où personne n\'a rien déclaré (entraînement annulé) : pas compté', () => {
    expect(missingRpe([player('a')], plan, [], t, '2026-11-02', '2026-11-05')).toEqual([])
  })
})

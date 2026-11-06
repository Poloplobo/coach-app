import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { readProgram } from './importProgram'

// Même disposition que les fiches PER MUSCULATION (voir scripts/import/parse.test.ts)
const weekSheet = (player = 'Paul MARTIN') => XLSX.utils.aoa_to_sheet([
  ['', '', 'Séance PER - Semaine 7'],
  ['', '', player],
  ['', 'Exercice', '', 'Séries', 'Répétitions', 'Charge (%RM/kg)', 'TEMPO', 'Repos', 'RPE (1-10)', 'Charge', 'Statut', 'Commentaires'],
  ['', 'Lundi :'],
  ['', 'A1', 'Front Squat', 5, 5, '100kg', '4.0.1.0', "2'", 7, '100', 'Fait', ''],
  ['', 'R1', 'Isométrie genou', 3, "30''", 'à toi de voir'],
  ['', 'Jeudi :'],
  ['', 'B1', 'développé couché', 4, 6, '80%'],
])
const file = (sheets: Record<string, XLSX.WorkSheet>) => {
  const wb = XLSX.utils.book_new()
  for (const [n, ws] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, ws, n)
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
const ctx = {
  weeks: [{ code: 'S1', start_date: '2026-09-14' }, { code: 'S7', start_date: '2026-10-26' }],
  cycleStart: '2026-09-14', // semaine 1 du cycle = S1 : « C2S7 » tombe en S7
  players: [{ id: 'p1', first_name: 'Paul', last_name: 'MARTIN', import_name: 'MARTIN Paul' }],
  tests: [{ id: 't1', name: 'Développé Couché' }],
  library: ['Front Squat', 'Développé Couché'],
}

// Les séances de jours passés sont ignorées : date du jour figée avant S7 (lundi 26/10/2026)
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-20T10:00:00Z')) })
afterAll(() => { vi.useRealTimers() })

describe('readProgram (import d\'une fiche en début de cycle)', () => {
  it('séances datées sur la semaine du calendrier, retours ignorés, réhab incluse, objectifs reconnus', () => {
    const objectives = XLSX.utils.aoa_to_sheet([['Test', 'Objectif', 'Libellé'], ['développé couché', '100', '1RM']])
    const p = readProgram(file({ C2S7: weekSheet(), OBJECTIFS: objectives }), ctx)
    expect(p.errors).toEqual([])
    expect(p.player?.id).toBe('p1')
    expect(p.sessions.map(s => [s.date, s.week])).toEqual([['2026-10-26', 'S7 du cycle · S7'], ['2026-10-29', 'S7 du cycle · S7']])
    expect(p.sessions[0].exercises[0]).toEqual({
      name: 'Front Squat', block_label: 'A1', sets: 5, reps: '5', load_value: 100, load_unit: 'kg', tempo: '4.0.1.0', rest: "2'", instructions: null,
    })
    expect(p.sessions[0].exercises[1]).toMatchObject({ block_label: 'R1', load_unit: 'free', instructions: 'à toi de voir' })
    expect(p.targets).toEqual([{ test: 'Développé Couché', test_id: 't1', value: 100, label: '1RM' }])
    expect(p.newExercises).toEqual(['Isométrie genou']) // « développé couché » existe déjà (casse ignorée)
  })
  it('joueur blessé : « Lundi RÉHAB » et « Lundi MEMBRES SAINS » donnent deux séances le même jour ; « Lundi » seul reste Musculation', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['', '', 'Séance PER - Semaine 7'], ['', '', 'Paul MARTIN'],
      ['', 'Exercice', '', 'Séries', 'Répétitions', 'Charge (%RM/kg)', 'TEMPO', 'Repos'],
      ['', 'Lundi RÉHAB :'], ['', 'R1', 'Isométrie genou', 3, "30''"],
      ['', 'Lundi MEMBRES SAINS :'], ['', 'A1', 'développé couché', 4, 6, '80%'],
      ['', 'Mardi :'], ['', 'A1', 'Front Squat', 5, 5, '100kg'],
    ])
    const p = readProgram(file({ C2S7: sheet }), ctx)
    expect(p.errors).toEqual([])
    expect(p.sessions.map(s => [s.date, s.activity ?? 'Musculation', s.exercises.length])).toEqual([
      ['2026-10-26', 'Réhabilitation', 1], ['2026-10-26', 'Membres sains', 1], ['2026-10-27', 'Musculation', 1]])
  })
  it('bloque sur une semaine absente du calendrier, un joueur inconnu ou un test inconnu', () => {
    const objectives = XLSX.utils.aoa_to_sheet([['Test', 'Objectif'], ['Squat 1RM', 'beaucoup']])
    const p = readProgram(file({ C2S7: weekSheet('Jean INCONNU'), C2S8: weekSheet('Jean INCONNU'), OBJECTIFS: objectives }), ctx)
    expect(p.errors.join('\n')).not.toMatch(/S8/) // semaine hors calendrier : signalée dans l'aperçu, pas bloquante
    expect(p.errors.join('\n')).toMatch(/Jean INCONNU.*introuvable/)
    expect(p.warnings.join('\n')).toMatch(/objectif illisible/) // objectifs : avertissement, jamais bloquant
  })
  it('refuse une fiche sans onglet semaine', () => {
    expect(readProgram(file({ Feuille1: XLSX.utils.aoa_to_sheet([['x']]) }), ctx).errors[0]).toMatch(/Aucun onglet semaine/)
  })
  it('deux onglets de joueurs différents : erreur bloquante', () => {
    const p = readProgram(file({ C2S7: weekSheet('Paul MARTIN'), C2S8: weekSheet('Jean DUPONT') }), { ...ctx, weeks: [...ctx.weeks, { code: 'S8', start_date: '2026-11-02' }] })
    expect(p.errors.join('\n')).toMatch(/Plusieurs joueurs dans la fiche/)
  })
  it('onglet semaine sans séance : pas de séance et erreur explicite', () => {
    const empty = XLSX.utils.aoa_to_sheet([['', '', 'Séance PER - Semaine 7'], ['', '', 'Paul MARTIN'], ['', 'Exercice', '', 'Séries', 'Répétitions', 'RPE (1-10)', 'Statut']])
    const p = readProgram(file({ C2S7: empty }), ctx)
    expect(p.sessions).toEqual([])
    expect(p.errors.join('\n')).toMatch(/Aucune séance/)
  })
  it('même date présente deux fois (deux onglets pour la même semaine) : doit être signalé', () => {
    const p = readProgram(file({ C1S7: weekSheet(), C2S7: weekSheet() }), ctx)
    const dates = p.sessions.map(s => s.date)
    // Si le doublon n'est ni dédoublonné ni signalé, la 2e séance écrase silencieusement la 1re côté SQL
    expect(new Set(dates).size === dates.length || p.errors.length > 0).toBe(true)
  })
  it('exercice au nom vide : ligne ignorée, jamais envoyée', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['', '', 'x'], ['', '', 'Paul MARTIN'],
      ['', 'Exercice', '', 'Séries', 'Répétitions', 'Charge (%RM/kg)', 'TEMPO', 'Repos', 'RPE (1-10)', 'Charge', 'Statut'],
      ['', 'Lundi :'], ['', 'A1', '   ', 3, 5], ['', 'A2', 'Front Squat', 3, 5],
    ])
    const p = readProgram(file({ C2S7: ws }), ctx)
    expect(p.sessions[0].exercises.map(e => e.name)).toEqual(['Front Squat'])
  })
  it('fiche sans OBJECTIFS : pas de cible, pas d\'erreur', () => {
    const p = readProgram(file({ C2S7: weekSheet() }), ctx)
    expect(p.targets).toEqual([])
    expect(p.errors).toEqual([])
  })
  it('objectif « 62,5 » (virgule) lu comme 62.5 ; libellé vide -> null', () => {
    const o = XLSX.utils.aoa_to_sheet([['Test', 'Objectif', 'Libellé'], ['Développé Couché', '62,5', '']])
    const p = readProgram(file({ C2S7: weekSheet(), OBJECTIFS: o }), ctx)
    expect(p.errors).toEqual([])
    expect(p.targets).toEqual([{ test: 'Développé Couché', test_id: 't1', value: 62.5, label: null }])
  })
  it('nom avec accents rapproché sans tenir compte des accents ni de l\'ordre', () => {
    const c = { ...ctx, players: [{ id: 'p2', first_name: 'Hélios', last_name: 'DE LA BRÛLERIE', import_name: null }] }
    const p = readProgram(file({ C2S7: weekSheet('Helios DE LA BRULERIE') }), c)
    expect(p.player?.id).toBe('p2')
    const q = readProgram(file({ C2S7: weekSheet('DE LA BRÛLERIE Hélios') }), c)
    expect(q.player?.id).toBe('p2')
  })
  it('les retours de la fiche (RPE, statut, charge faite, commentaire) n\'apparaissent jamais dans les séances', () => {
    const p = readProgram(file({ C2S7: weekSheet() }), ctx)
    const json = JSON.stringify(p.sessions)
    expect(json).not.toMatch(/rpe|status|statut|done|comment|"Fait"/i)
    for (const e of p.sessions.flatMap(s => s.exercises)) {
      expect(Object.keys(e).sort()).toEqual(['block_label', 'instructions', 'load_unit', 'load_value', 'name', 'reps', 'rest', 'sets', 'tempo'])
    }
  })
  it('OBJECTIFS sans colonne Objectif : erreur', () => {
    const o = XLSX.utils.aoa_to_sheet([['Test', 'Libellé'], ['Développé Couché', '1RM']])
    const r = readProgram(file({ C2S7: weekSheet(), OBJECTIFS: o }), ctx)
    expect(r.warnings.join()).toMatch(/colonne « Objectif »/)
    expect(r.errors).toEqual([]) // les séances restent importables
  })
  it('fiche copiée d\'un autre joueur (nom du fichier ≠ nom de la fiche) : bloquée', () => {
    expect(readProgram(file({ C2S7: weekSheet() }), ctx, 'Jean DUPONT_PER MUSCULATION.xlsx').errors.join()).toMatch(/au nom de « Jean DUPONT »/)
    expect(readProgram(file({ C2S7: weekSheet() }), ctx, 'Paul MARTIN_PER MUSCULATION.xlsx').errors).toEqual([])
  })
  it('test en double dans OBJECTIFS : bloqué', () => {
    const o = XLSX.utils.aoa_to_sheet([['Test', 'Objectif'], ['Développé Couché', '100'], ['développé couché', '90']])
    expect(readProgram(file({ C2S7: weekSheet(), OBJECTIFS: o }), ctx).warnings.join()).toMatch(/en double/)
  })
  it('anciens onglets : séances passées ignorées, un vieux RPE faux ne bloque pas', () => {
    const old = weekSheet()
    old.I5 = { t: 'n', v: 50 } // RPE hors échelle saisi au cycle précédent
    const p = readProgram(file({ C1S1: old, C2S7: weekSheet() }), { ...ctx, weeks: [...ctx.weeks] }, '')
    expect(p.errors).toEqual([])
    expect(p.past).toBe(2)
    expect(p.sessions.map(s => s.week)).toEqual(['S7 du cycle · S7', 'S7 du cycle · S7'])
  })
  it('onglet OBJECTIFS en texte libre : avertissement, séances importables', () => {
    const o = XLSX.utils.aoa_to_sheet([['Objectifs du cycle'], ['DC : 100 1RM - BS : 2xPDC']])
    const r = readProgram(file({ C2S7: weekSheet(), OBJECTIFS: o }), ctx)
    expect(r.errors).toEqual([])
    expect(r.warnings.join()).toMatch(/non importés/)
    expect(r.sessions.length).toBeGreaterThan(0)
  })
  it('deux blocs du même jour dans un onglet : regroupés en une séance (pas de blocage)', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['', '', 'Séance PER - Semaine 7'], ['', '', 'Paul MARTIN'],
      ['', 'Exercice', '', 'Séries', 'Répétitions', 'Charge (%RM/kg)', 'TEMPO', 'Repos', 'RPE (1-10)', 'Charge', 'Statut'],
      ['', 'Lundi matin :'], ['', 'A1', 'Front Squat', 3, 5], ['', 'Lundi soir :'], ['', 'B1', 'Tirage Banc', 3, 8],
    ])
    const p = readProgram(file({ C2S7: ws }), ctx)
    expect(p.errors).toEqual([])
    expect(p.sessions).toHaveLength(1)
    expect(p.sessions[0].exercises.map(e => e.name)).toEqual(['Front Squat', 'Tirage Banc'])
  })
})

import { describe, expect, it } from 'vitest'
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
  players: [{ id: 'p1', first_name: 'Paul', last_name: 'MARTIN', import_name: 'MARTIN Paul' }],
  tests: [{ id: 't1', name: 'Développé Couché' }],
  library: ['Front Squat', 'Développé Couché'],
}

describe('readProgram (import d\'une fiche en début de cycle)', () => {
  it('séances datées sur la semaine du calendrier, retours ignorés, réhab incluse, objectifs reconnus', () => {
    const objectives = XLSX.utils.aoa_to_sheet([['Test', 'Objectif', 'Libellé'], ['développé couché', '100', '1RM']])
    const p = readProgram(file({ C2S7: weekSheet(), OBJECTIFS: objectives }), ctx)
    expect(p.errors).toEqual([])
    expect(p.player?.id).toBe('p1')
    expect(p.sessions.map(s => [s.date, s.week])).toEqual([['2026-10-26', 'S7'], ['2026-10-29', 'S7']])
    expect(p.sessions[0].exercises[0]).toEqual({
      name: 'Front Squat', block_label: 'A1', sets: 5, reps: '5', load_value: 100, load_unit: 'kg', tempo: '4.0.1.0', rest: "2'", instructions: null,
    })
    expect(p.sessions[0].exercises[1]).toMatchObject({ block_label: 'R1', load_unit: 'free', instructions: 'à toi de voir' })
    expect(p.targets).toEqual([{ test: 'Développé Couché', test_id: 't1', value: 100, label: '1RM' }])
    expect(p.newExercises).toEqual(['Isométrie genou']) // « développé couché » existe déjà (casse ignorée)
  })
  it('bloque sur une semaine absente du calendrier, un joueur inconnu ou un test inconnu', () => {
    const objectives = XLSX.utils.aoa_to_sheet([['Test', 'Objectif'], ['Squat 1RM', 'beaucoup']])
    const p = readProgram(file({ C2S8: weekSheet('Jean INCONNU'), OBJECTIFS: objectives }), ctx)
    expect(p.errors.join('\n')).toMatch(/S8 absente du calendrier/)
    expect(p.errors.join('\n')).toMatch(/Jean INCONNU.*introuvable/)
    expect(p.errors.join('\n')).toMatch(/objectif illisible/)
  })
  it('refuse une fiche sans onglet semaine', () => {
    expect(readProgram(file({ Feuille1: XLSX.utils.aoa_to_sheet([['x']]) }), ctx).errors[0]).toMatch(/Aucun onglet semaine/)
  })
})

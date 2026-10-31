import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { readMaxi } from './importMaxi'

const file = (rows: unknown[][]) => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Maxi')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
const ctx = {
  players: [{ id: 'a', first_name: 'Paul', last_name: 'MARTIN', import_name: 'MARTIN Paul' }, { id: 'b', first_name: 'Élodie', last_name: 'DUPRÉ', import_name: null }],
  tests: [{ id: 't1', name: 'Développé Couché 1RM' }, { id: 't2', name: 'Back Squat 1RM' }],
}

describe('readMaxi : maxi et objectifs du groupe', () => {
  it('maxi et objectif, l\'un ou l\'autre vide, virgule décimale, nom avec accents, test sans tenir compte de la casse', () => {
    const r = readMaxi(file([
      ['Joueur', 'Test', 'Maxi', 'Objectif', 'Libellé'],
      ['Paul MARTIN', 'développé couché 1rm', '87,5', 100, 'fin de saison'],
      ['Elodie Dupre', 'Back Squat 1RM', 120, ''],
      ['MARTIN Paul', 'Back Squat 1RM', '', 140],
    ]), ctx)
    expect(r.errors).toEqual([])
    expect(r.rows.map(x => [x.player.id, x.test.id, x.maxi, x.target, x.label])).toEqual([
      ['a', 't1', 87.5, 100, 'fin de saison'], ['b', 't2', 120, null, null], ['a', 't2', null, 140, null],
    ])
  })
  it('joueur ou test inconnu, doublon, valeur illisible : bloqués', () => {
    const e = readMaxi(file([
      ['Joueur', 'Test', 'Maxi', 'Objectif'],
      ['Jean INCONNU', 'Back Squat 1RM', 100, ''],
      ['Paul MARTIN', 'Squat bulgare', 100, ''],
      ['Paul MARTIN', 'Back Squat 1RM', 100, ''],
      ['Paul MARTIN', 'back squat 1RM', 110, ''],
      ['Élodie DUPRÉ', 'Back Squat 1RM', 'beaucoup', ''],
    ]), ctx).errors.join('\n')
    expect(e).toMatch(/Jean INCONNU.*introuvable/)
    expect(e).toMatch(/Squat bulgare.*inconnu/)
    expect(e).toMatch(/en double/)
    expect(e).toMatch(/illisible/)
  })
  it('sans en-tête ou sans colonne Maxi ni Objectif : refusé', () => {
    expect(readMaxi(file([['Nom', 'Valeur']]), ctx).errors[0]).toMatch(/introuvable/)
    expect(readMaxi(file([['Joueur', 'Test', 'Commentaire']]), ctx).errors[0]).toMatch(/absentes/)
  })
})

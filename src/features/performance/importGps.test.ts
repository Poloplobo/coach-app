import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { readGps, sheetToXlsx } from './importGps'

// Même disposition que l'export du GPS (onglet « R92 ») : une ligne de titre, puis l'en-tête
const HEAD = ['POSTE', 'NOM', 'KM Total', 'DHI (>21km/h)', 'Accélération (>6m/s)', 'Vmax', 'Temps (min)', 'GPS', 'Joueurs']
const file = (rows: unknown[][], sheets: Record<string, unknown[][]> = {}) => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Match R92'], HEAD, ...rows]), 'R92 (1)')
  for (const [n, r] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r), n)
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
const players = [
  { id: 'a', first_name: 'Paul', last_name: 'MARTIN', import_name: 'MARTIN Paul' },
  { id: 'b', first_name: 'Léo', last_name: 'DUPONT', import_name: null },
  { id: 'c', first_name: 'Hugo', last_name: 'DUPONT', import_name: null },
]
const positions = new Map([['PILIER', 'Pilier'], ['CENTRE', 'Centre'], ['3ÈME LIGNE AILE', '3e ligne']])
const ctx = { players, positions }

describe('readGps : export brut du GPS d\'un match', () => {
  it('lit les lignes, rapproche par « Prénom NOM » (homonymes de famille distingués)', () => {
    const p = readGps(file([
      ['PILIER', 'MARTIN', 4970, 12, 15, 26.4, 70, 3, 'Paul MARTIN'],
      ['3ème ligne aile', 'DUPONT', 3310, 0, 9, '', 40, 5, 'Léo DUPONT'],
    ]), ctx)
    expect(p.errors).toEqual([])
    expect(p.sheet).toBe('R92 (1)')
    expect(p.rows.map(r => [r.player.id, r.position, r.minutes, r.distance_m, r.vmax])).toEqual([['a', 'PILIER', 70, 4970, 26.4], ['b', '3ÈME LIGNE AILE', 40, 3310, null]])
  })
  it('sans colonne Joueurs : nom de famille seul, bloqué s\'il est porté par deux joueurs', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEAD.slice(0, 7), ['PILIER', 'MARTIN', 4970, 12, 15, 26, 70], ['CENTRE', 'DUPONT', 5000, 50, 20, 28, 70]]), 'X')
    const p = readGps(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), ctx)
    expect(p.rows.map(r => r.player.id)).toEqual(['a'])
    expect(p.errors.join()).toMatch(/DUPONT.*plusieurs joueurs/)
  })
  it('nom seul dans « Joueurs » : nom de famille unique rattaché ; ligne sans donnée GPS : ignorée sans bloquer', () => {
    const p = readGps(file([
      ['PILIER', 'MARTIN', 4970, 12, 15, 26, 70, 3, 'MARTIN'],
      ['CENTRE', 'DUPONT', '', '', '', '', '', '', 'Léo DUPONT'],
    ]), ctx)
    expect(p.errors).toEqual([])
    expect(p.rows.map(r => r.player.id)).toEqual(['a'])
    expect(p.warnings.join()).toMatch(/DUPONT.*aucune donnée GPS/)
    expect(readGps(file([['CENTRE', 'DUPONT', 5000, 50, 20, 28, 70, 3, 'DUPONT']]), ctx).errors.join()).toMatch(/plusieurs joueurs/)
  })
  it('vigilance poste : un poste sans attendu bloque, avec la liste des postes connus', () => {
    expect(readGps(file([['OUVREUR', 'MARTIN', 4970, 12, 15, 26, 70, 3, 'Paul MARTIN']]), ctx).errors.join()).toMatch(/poste « OUVREUR » sans attendu.*PILIER/)
  })
  it('doublon, valeurs illisibles, distance en km : bloqués ; joueur hors effectif : écarté avec avertissement', () => {
    const p = readGps(file([
      ['PILIER', 'INCONNU', 4970, 12, 15, 26, 70, 1, 'Jean INCONNU'],
      ['PILIER', 'MARTIN', 4970, 12, 15, 26, 70, 3, 'Paul MARTIN'],
      ['PILIER', 'MARTIN', 4970, 12, 15, 26, 70, 3, 'Paul MARTIN'],
      ['CENTRE', 'DUPONT', 'abc', 12, 15, 26, 70, 4, 'Léo DUPONT'],
      ['CENTRE', 'DUPONT', 4.97, 12, 15, 26, 70, 5, 'Hugo DUPONT'],
    ]), ctx)
    const e = p.errors.join('\n')
    expect(e).not.toMatch(/INCONNU/)
    expect(p.warnings.join()).toMatch(/Jean INCONNU hors effectif, non importé/)
    expect(e).toMatch(/présent deux fois/)
    expect(e).toMatch(/illisibles/)
    expect(e).toMatch(/en kilomètres/)
  })
  it('temps de jeu nul ou Vmax aberrante : bloqués', () => {
    const e = readGps(file([['PILIER', 'MARTIN', 4970, 12, 15, 26, 0, 3, 'Paul MARTIN'], ['CENTRE', 'DUPONT', 5000, 12, 15, 60, 70, 4, 'Léo DUPONT']]), ctx).errors.join('\n')
    expect(e).toMatch(/temps de jeu/)
    expect(e).toMatch(/Vmax 60/)
  })
  it('fichier sans en-tête ou avec deux matchs : refusé', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['rien']]), 'A')
    expect(readGps(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), ctx).errors[0]).toMatch(/introuvable/)
    expect(readGps(file([], { 'R93': [HEAD] }), ctx).errors[0]).toMatch(/un match par fichier/)
  })
  it('lignes vides ignorées ; ligne de total sans joueur reconnu : bloquée', () => {
    const ok = readGps(file([[], ['PILIER', 'MARTIN', 4970, 12, 15, 26, 70, 3, 'Paul MARTIN'], ['', '', '', '', '', '', '', '', '']]), ctx)
    expect(ok.errors).toEqual([])
    expect(ok.rows).toHaveLength(1)
    const total = readGps(file([['PILIER', 'MARTIN', 4970, 12, 15, 26, 70, 3, 'Paul MARTIN'], ['', 'TOTAL', 4970, 12, 15, 26, 70, '', '']]), ctx)
    expect(total.errors.join()).toMatch(/TOTAL.*« Joueurs » vide/)
  })
  it('Vmax vide : acceptée (null)', () => {
    const p = readGps(file([['PILIER', 'MARTIN', 4970, 12, 15, '', 70, 3, 'Paul MARTIN']]), ctx)
    expect(p.errors).toEqual([])
    expect(p.rows[0].vmax).toBeNull()
  })
  it('nombres en texte avec espaces et virgule : « 4 970 », « 26,4 »', () => {
    const p = readGps(file([['PILIER', 'MARTIN', '4 970', ' 12 ', '15', '26,4', '70', 3, 'Paul MARTIN']]), ctx)
    expect(p.errors).toEqual([])
    expect(p.rows[0]).toMatchObject({ distance_m: 4970, hi_distance_m: 12, accelerations: 15, vmax: 26.4, minutes: 70 })
  })
  it('poste en minuscules ou avec espaces autour : normalisé', () => {
    const p = readGps(file([['  3ème  ligne   aile ', 'MARTIN', 4970, 12, 15, 26, 70, 3, 'Paul MARTIN']]), ctx)
    expect(p.errors).toEqual([])
    expect(p.rows[0].position).toBe('3ÈME LIGNE AILE')
  })
  it('colonne Joueurs présente mais vide sur une ligne : bloqué (un invité homonyme ne doit pas être rattaché)', () => {
    const p = readGps(file([['PILIER', 'MARTIN', 4970, 12, 15, 26, 70, 3, '']]), ctx)
    expect(p.rows).toEqual([])
    expect(p.errors.join()).toMatch(/MARTIN.*« Joueurs » vide/)
  })
  it('remplaçant entré tard : 85 m en 3 min acceptés (pas pris pour des kilomètres)', () => {
    const p = readGps(file([['PILIER', 'MARTIN', 85, 0, 1, 22, 3, 3, 'Paul MARTIN']]), ctx)
    expect(p.errors).toEqual([])
    expect(p.rows[0].distance_m).toBe(85)
  })
})

describe('readGps : onglet « Données » du classeur GPS - MATCH (plusieurs matchs)', () => {
  const DATA = ['Match', 'Date', 'Adversaire', 'Nom', 'Poste', 'Temps (min)', 'Distance totale (m)', 'Distance HI >21 km/h (m)', 'Accélérations', 'Vmax (km/h)', 'Groupe de poste', 'Prénom NOM']
  const book = file([['PILIER', 'MARTIN', 1, 1, 1, 20, 70, 3, 'Paul MARTIN']], { 'Données': [['Données GPS par match'], [], DATA,
    ['J1 - R92', '', 'R92', 'MARTIN', 'PILIER', 40, 3310, 58, 10, 25.2, 'Pilier', 'Paul MARTIN'],
    ['J2 - USON', '', 'USON', 'MARTIN', 'PILIER', 70, 4900, 120, 14, 26, 'Pilier', 'Paul MARTIN'],
    ['J2 - USON', '', 'USON', 'DUPONT', 'CENTRE', 65, 5100, 300, 12, 29, 'Centre', 'Léo DUPONT']] })
  it('lit seulement les lignes de la journée choisie, jamais l\'onglet d\'export voisin', () => {
    const p = readGps(book, ctx, 'J2')
    expect(p.errors).toEqual([])
    expect(p.sheet).toBe('Données (J2)')
    expect(p.rows.map(r => [r.player.id, r.minutes, r.distance_m, r.hi_distance_m, r.vmax])).toEqual([['a', 70, 4900, 120, 26], ['b', 65, 5100, 300, 29]])
    expect(readGps(book, ctx, 'J1').rows.map(r => r.distance_m)).toEqual([3310])
  })
  it('journée absente ou non choisie : refusé (pas de repli sur l\'onglet d\'export)', () => {
    expect(readGps(book, ctx, 'J3').errors[0]).toMatch(/Aucune ligne « J3 »/)
    expect(readGps(book, ctx).errors[0]).toMatch(/choisis un match du calendrier/)
  })
})

describe('sheetToXlsx : lignes de la feuille Google', () => {
  it('mêmes lignes que le classeur : même contrôle et même résultat', () => {
    const rows = [['Données GPS par match'], [], ['Match', 'Date', 'Adversaire', 'Nom', 'Poste', 'Temps (min)', 'Distance totale (m)', 'Distance HI >21 km/h (m)', 'Accélérations', 'Vmax (km/h)', 'Prénom NOM'],
      ['J1 - R92', '', 'R92', 'MARTIN', 'PILIER', 40, 3310, 58, 10, 25.2, 'Paul MARTIN']]
    const p = readGps(sheetToXlsx(rows), ctx, 'J1')
    expect(p.errors).toEqual([])
    expect(p.rows.map(r => [r.player.id, r.distance_m])).toEqual([['a', 3310]])
  })
})

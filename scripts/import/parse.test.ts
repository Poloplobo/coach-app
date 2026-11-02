import { describe, expect, it } from 'vitest'
import XLSX from 'xlsx'
import { nameKey, weekStart } from './names'
import { parseRpe } from './parseRpe'
import { parsePositions, parseTemplate, parseWeeks } from './parseChargePer'
import { parseCorrections, parseLoad, parseMuscuSheet } from './parseMuscu'
import { parseTestsCsv } from './parseTests'
import { parseTargets } from './parseTargets'

it('nameKey rapproche les orthographes d\'un même joueur', () => {
  const key = nameKey('LEROY-BLANC Léo')
  expect(nameKey('Léo LEROY BLANC')).toBe(key)
  expect(nameKey('leroy_blanc_leo')).toBe(key)
  expect(nameKey('Eloi BERNARD')).toBe(nameKey('BERNARD Éloi'))
})

it('weekStart avance d\'une semaine par numéro, y compris au changement d\'heure', () => {
  expect(weekStart('2026-09-14', 4)).toBe('2026-10-05')
  expect(weekStart('2026-09-14', 8)).toBe('2026-11-02')
})

describe('parseRpe', () => {
  const answer = (statut: string, joueur = 'dupont_jean', jour = '2026-09-14') => ({
    joueur, horodatage: `${jour}T19:47:13`, semaine: 'S1', date_seance: jour, statut, total_srpe_formulaire: 300,
    activites: [{ libelle: 'Musculation', rpe: 5, duree_min: 60 }],
  })

  it('n\'importe que les réponses ok, avec l\'heure de Paris', () => {
    const { logs, skipped, expectedTotals } = parseRpe({ reponses: [answer('ok'), answer('doublon'), answer('orpheline')] })
    expect(logs).toHaveLength(1)
    expect(skipped).toBe(2)
    expect(logs[0].validatedAt).toBe('2026-09-14T19:47:13+02:00')
    expect(expectedTotals.get('dupont jean | S1')).toBe(300)
  })

  it('refuse deux fois la même activité le même jour', () => {
    expect(() => parseRpe({ reponses: [answer('ok'), answer('ok')] })).toThrow(/deux fois/)
  })
})

describe('parseChargePer', () => {
  it('lit le calendrier et calcule les lundis', () => {
    const rows = [
      ['Code Semaine', 'Semaine', 'Type de Semaine PER', 'Cycle'],
      ['S1', 'Semaine 1 (Nantes)', 'Semaine Compétition', 'Cycle 1', '', '', '', '', '', '', '', '', 'Charge foncière'],
      ['S2', 'Semaine 2 (OFF)', 'Semaine Régénération', 'Cycle 1'],
    ]
    expect(parseWeeks(rows, '2026-09-14')).toEqual([
      { code: 'S1', label: 'Semaine 1 (Nantes)', startDate: '2026-09-14', weekType: 'COMP', cycle: 'Cycle 1', note: 'Charge foncière', off: false },
      { code: 'S2', label: 'Semaine 2 (OFF)', startDate: '2026-09-21', weekType: 'REG', cycle: 'Cycle 1', note: '', off: true },
    ])
  })

  it('lit la semaine type : jours fusionnés, activités, durées, arrêt au total hebdo', () => {
    const rows = [
      ['POSTE', 'ATHLÈTE', 'LUNDI', '', 'MARDI', 'JEUDI', 'TOTAL HEBDO (min)'],
      ['', '', 'Dév. Tactique', 'Musculation', 'Collectif Réduit', 'Récupération', ''],
      ['RÉFÉRENCE', 'DURÉE STANDARD (min)', '30', '60', '60', '', '150'],
    ]
    expect(parseTemplate(rows)).toEqual([
      { day: 0, activity: 'Dév. Tactique', durationMin: 30 },
      { day: 0, activity: 'Musculation', durationMin: 60 },
      { day: 1, activity: 'Collectif Réduit', durationMin: 60 },
    ])
  })

  it('refuse un type de semaine inconnu', () => {
    expect(() => parseWeeks([['Code Semaine'], ['S1', 'x', 'Semaine Spéciale', 'Cycle 1']], '2026-09-14')).toThrow(/inconnu/)
  })

  it('lit les postes entre la ligne de référence et la moyenne', () => {
    const rows = [['RÉFÉRENCE', 'DURÉE STANDARD (min)'], ['Pilier', 'DUPONT Jean'], ['MOYENNE GROUPE', 'COLLECTIF PER']]
    expect(parsePositions(rows)).toEqual([{ playerKey: 'dupont jean', position: 'Pilier' }])
  })
})

it('parseLoad comprend %RM, %PDC, kg et texte libre', () => {
  expect(parseLoad('80.00%')).toEqual({ loadValue: 80, loadUnit: 'pct_rm' })
  expect(parseLoad('60%PDC')).toEqual({ loadValue: 60, loadUnit: 'bw' })
  expect(parseLoad('20')).toEqual({ loadValue: 20, loadUnit: 'kg' })
  expect(parseLoad('à toi de voir')).toEqual({ loadValue: null, loadUnit: 'free' })
  expect(parseLoad(null)).toEqual({ loadValue: null, loadUnit: null })
})

describe('parseMuscuSheet', () => {
  // Même disposition que les fiches : colonne A vide, titre, nom, puis jours et exercices
  const sheet = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['', '', 'Séance PER - Semaine 2'],
      ['', '', 'Paul MARTIN'],
      ['', 'Exercice', '', 'Séries', 'Répétitions', 'Charge (%RM/kg)', 'TEMPO', 'Repos', 'RPE (1-10)', 'Charge', 'Statut', 'Commentaires'],
      ['', 'Lundi :'],
      ['', 'A1', 'Front Squat', 5, 5, '80%', '4.0.1.0', "2'", 7, '2x125 1x120', 'Fait', 'Douleur bas du dos'],
      ['', 'A2', 'SuperMan', 5, '6/côté', 'à toi de voir', '2.0.1.0', '', '', '', 'Non Fait'],
      ['', 'MOB', 'Mobilité de hanche', 'RE'],
      ['', 'Mercredi :'],
      ['', 'F', 'RCervicales :\nFlexion', 3, "30''"],
    ])
    ws['!merges'] = [XLSX.utils.decode_range('H5:H6')] // repos commun à A1 / A2
    return ws
  }

  it('découpe par jour, garde les reps en texte et reporte les cellules fusionnées', () => {
    const { playerName, sessions } = parseMuscuSheet(sheet(), 'C1S2', '2026-09-14')
    expect(playerName).toBe('Paul MARTIN')
    expect(sessions.map(s => s.date)).toEqual(['2026-09-21', '2026-09-23'])
    const [a1, a2, mob] = sessions[0].exercises
    expect(a1).toMatchObject({ block: 'A1', sets: 5, reps: '5', loadValue: 80, loadUnit: 'pct_rm', rest: "2'" })
    expect(a1.feedback).toEqual({ rpe: 7, doneLoad: '2x125 1x120', status: 'fait', comment: 'Douleur bas du dos' })
    expect(a2).toMatchObject({ reps: '6/côté', loadUnit: 'free', rest: "2'" })
    expect(a2.feedback).toEqual({ rpe: null, doneLoad: null, status: 'non fait', comment: null })
    expect(mob).toMatchObject({ sets: null, feedback: null })
    expect(sessions[1].exercises[0]).toMatchObject({ name: 'RCervicales : Flexion', reps: "30''" })
  })

  it('refuse un RPE hors échelle plutôt que de le perdre', () => {
    const ws = sheet()
    ws.I5 = { t: 'n', v: 12 }
    expect(() => parseMuscuSheet(ws, 'C1S2', '2026-09-14')).toThrow(/RPE 12 hors de l'échelle/)
  })

  it('fiche sans colonne « Repos » : chaque colonne est lue par son titre, sans décalage', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['', '', 'Séance PER - Semaine 1'],
      ['', '', 'Léo LEROY-BLANC'],
      ['', 'Exercice', '', 'Séries', 'Répétitions', 'Charge (%RM/kg)', 'TEMPO', 'RPE (1-10)', 'Charge', 'Statut', 'Commentaires'],
      ['', 'Lundi :'],
      ['', 'A1', 'Développé Couché', 5, 5, '82.50%', '2.0.1.0', 8, 90, 'Fait', 'RAS'],
    ])
    const ex = parseMuscuSheet(ws, 'C1S1', '2026-09-14').sessions[0].exercises[0]
    expect(ex).toMatchObject({ tempo: '2.0.1.0', rest: null, loadValue: 82.5 })
    expect(ex.feedback).toEqual({ rpe: 8, doneLoad: '90', status: 'fait', comment: 'RAS' })
  })

  it('applique une correction connue (RPE et charge inversés) sans toucher au reste de la fiche', () => {
    const ws = sheet()
    ws.I5 = { t: 'n', v: 50 } // RPE saisi dans la mauvaise case
    ws.J5 = { t: 's', v: '2' }
    const fix = parseCorrections('Joueur;Onglet;Exercice;RPE;Charge réalisée\nMARTIN Paul;C1S2;Front Squat;2;50\n')
    const a1 = parseMuscuSheet(ws, 'C1S2', '2026-09-14', fix).sessions[0].exercises[0]
    expect(a1.feedback).toMatchObject({ rpe: 2, doneLoad: '50', status: 'fait' })
    expect(() => parseMuscuSheet(ws, 'C1S2', '2026-09-14')).toThrow(/RPE 50/) // sans correction : refusé
  })

  it('refuse une fiche dont il manque une colonne indispensable', () => {
    const ws = XLSX.utils.aoa_to_sheet([['', 'Exercice', '', 'Séries', 'Répétitions'], ['', 'Lundi :']])
    expect(() => parseMuscuSheet(ws, 'C1S1', '2026-09-14')).toThrow(/colonne/)
  })

  it('refuse un onglet mal nommé', () => {
    expect(() => parseMuscuSheet(sheet(), 'Feuille 5', '2026-09-14')).toThrow(/C<cycle>S<semaine>/)
  })
})

describe('parseTargets', () => {
  it('lit Joueur | Test | Objectif | Libellé, virgule décimale, lignes vides ignorées', () => {
    const rows = [['OBJECTIFS 2026/27'], ['Joueur', 'Test', 'Objectif', 'Libellé'],
      ['DUPONT Jean', 'Développé Couché 1RM', '100', ''], ['', '', '', ''], ['DUPONT Jean', 'Sprint 10m', '1,75', 'sous 1,75 s']]
    expect(parseTargets(rows)).toEqual([
      { playerName: 'DUPONT Jean', test: 'Développé Couché 1RM', value: 100, label: null },
      { playerName: 'DUPONT Jean', test: 'Sprint 10m', value: 1.75, label: 'sous 1,75 s' },
    ])
  })

  it('refuse un objectif illisible plutôt que de l\'ignorer', () => {
    expect(() => parseTargets([['Joueur', 'Test', 'Objectif'], ['DUPONT Jean', 'CMJ', '2xPDC']])).toThrow(/ligne 2/)
  })
})

describe('parseTestsCsv', () => {
  const header = 'import_name;Période;ID;Joueur;Taille (cm);Poids (kg);Dév. couché (kg);Format DC;Traction (rép.);Front squat (kg);Format FS;Dév. militaire (kg);10 m (s);50 m (s);Yo-Yo (m);Broad jump (cm);CMJ (cm);K-Push flexion (N/kg);K-Push extension (N/kg);Commentaire'

  it('lit les virgules, ignore vide et ABS, applique le format DC / FS', () => {
    const { results, measurements } = parseTestsCsv(`${header}\nMARTIN Paul;P1;J43;Martin Paul;179,5;78,2;75;1RM;15;;;50;1,75;;ABS;;;;;`)
    expect(results).toEqual([
      { importName: 'MARTIN Paul', period: 'P1', test: 'Développé Couché 1RM', value: 75 },
      { importName: 'MARTIN Paul', period: 'P1', test: 'Développé Militaire 3RM', value: 50 },
      { importName: 'MARTIN Paul', period: 'P1', test: 'Traction Stricte', value: 15 },
      { importName: 'MARTIN Paul', period: 'P1', test: 'Sprint 10m', value: 1.75 },
    ])
    expect(measurements).toEqual([{ importName: 'MARTIN Paul', heightCm: 179.5, weightKg: 78.2 }])
  })

  it('refuse une valeur illisible', () => {
    expect(() => parseTestsCsv(`${header}\nX;P1;J1;X;;;quatre-vingt`)).toThrow(/illisible/)
  })
})

describe('parseLoad : charges des fiches du cycle 2', () => {
  it('un seul %, éventuellement d\'une xRM : %RM, référence et précision gardées en consigne', () => {
    expect(parseLoad('50%RM')).toEqual({ loadValue: 50, loadUnit: 'pct_rm' })
    expect(parseLoad('92,5%3RM')).toEqual({ loadValue: 92.5, loadUnit: 'pct_rm', note: '92,5%3RM' })
    expect(parseLoad('90%3RM\n3 RER')).toEqual({ loadValue: 90, loadUnit: 'pct_rm', note: '90%3RM 3 RER' })
    expect(parseLoad('70%3RM Front Squat')).toMatchObject({ loadValue: 70, loadUnit: 'pct_rm' })
  })
  it('pyramide (plusieurs %), « LOURD », « RACK » : libre ; « PDC » seul : poids de corps', () => {
    expect(parseLoad('110%3RM\n90%3RM\n70%3RM')).toEqual({ loadValue: null, loadUnit: 'free' })
    expect(parseLoad('LOURD\nRER 3')).toEqual({ loadValue: null, loadUnit: 'free' })
    expect(parseLoad('PDC')).toEqual({ loadValue: null, loadUnit: 'bw' })
    expect(parseLoad('60% PDC')).toEqual({ loadValue: 60, loadUnit: 'bw' })
  })
})

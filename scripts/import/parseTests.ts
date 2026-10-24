// data/import/tests-per.csv : extrait des joueurs PER du fichier « TESTING COMPLET - CRABOS 2026/27 » (onglet Saisie)
type Row = Record<string, string>

// Colonne du fichier → nom du test dans test_definitions (DC et FS : 3RM si le format est vide, comme dans le fichier)
const TESTS: [string, (row: Row) => string][] = [
  ['Dév. couché (kg)', r => `Développé Couché ${r['Format DC'] || '3RM'}`],
  ['Front squat (kg)', r => `Front Squat ${r['Format FS'] || '3RM'}`],
  ['Dév. militaire (kg)', () => 'Développé Militaire 3RM'],
  ['Traction (rép.)', () => 'Traction Stricte'],
  ['10 m (s)', () => 'Sprint 10m'],
  ['50 m (s)', () => 'Sprint 50m'],
  ['Yo-Yo (m)', () => 'Yo-Yo Test'],
  ['Broad jump (cm)', () => 'Broad Jump'],
  ['CMJ (cm)', () => 'CMJ'],
  ['K-Push flexion (N/kg)', () => 'K-Push Flexion'],
  ['K-Push extension (N/kg)', () => 'K-Push Extension'],
]

// Vide = test non passé, ABS = absent : rien n'est importé
function value(raw: string | undefined, where: string): number | null {
  const t = raw?.trim() ?? ''
  if (!t || t.toUpperCase() === 'ABS') return null
  const n = Number(t.replace(',', '.'))
  if (Number.isNaN(n)) throw new Error(`${where} : valeur illisible « ${t} »`)
  return n
}

export type TestResult = { importName: string; period: string; test: string; value: number }
export type Measurement = { importName: string; heightCm: number | null; weightKg: number | null }

export function parseTestsCsv(csv: string) {
  const [header, ...lines] = csv.split(/\r?\n/).filter(l => l.trim())
  const cols = header.split(';')
  const results: TestResult[] = []
  const measurements: Measurement[] = []
  for (const line of lines) {
    const cells = line.split(';')
    const row: Row = Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']))
    const where = `${row.import_name} ${row['Période']}`
    for (const [col, testName] of TESTS) {
      const v = value(row[col], `${where} / ${col}`)
      if (v !== null) results.push({ importName: row.import_name, period: row['Période'], test: testName(row), value: v })
    }
    const heightCm = value(row['Taille (cm)'], `${where} / taille`)
    const weightKg = value(row['Poids (kg)'], `${where} / poids`)
    if (heightCm !== null || weightKg !== null) measurements.push({ importName: row.import_name, heightCm, weightKg })
  }
  return { results, measurements }
}

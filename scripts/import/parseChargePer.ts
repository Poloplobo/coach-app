// charge-per.xlsx : calendrier (CONFIG_SEMAINES_PER) et postes (PLANNING_CHARGES)
import { nameKey, weekStart } from './names'

type Rows = string[][]

const WEEK_TYPES: Record<string, string> = {
  'Semaine Développement': 'DEV',
  'Semaine Compétition': 'COMP',
  'Semaine Régénération': 'REG',
}

// off : semaine sans entraînement collectif, repérée par « (OFF) » dans son libellé
export type SeasonWeek = { code: string; label: string; startDate: string; weekType: string; cycle: string; note: string; off: boolean }

// Tableau « CALENDRIER D'ASSIGNATION » : Code Semaine | Semaine | Type | Cycle | … | Note / Phase (colonne 12)
export function parseWeeks(rows: Rows, seasonStart: string): SeasonWeek[] {
  const header = rows.findIndex(r => r[0]?.trim() === 'Code Semaine')
  if (header < 0) throw new Error('CONFIG_SEMAINES_PER : en-tête « Code Semaine » introuvable')
  return rows.slice(header + 1)
    .filter(r => /^S\d+$/.test(r[0]?.trim() ?? ''))
    .map(r => {
      const weekType = WEEK_TYPES[r[2]?.trim()]
      if (!weekType) throw new Error(`${r[0]} : type de semaine inconnu « ${r[2]} »`)
      return {
        code: r[0].trim(),
        label: r[1].trim(),
        startDate: weekStart(seasonStart, Number(r[0].trim().slice(1))),
        weekType,
        cycle: r[3].trim(),
        note: r[12]?.trim() ?? '',
        off: /\(OFF\)/i.test(r[1]),
      }
    })
}

export type TemplateActivity = { day: number; activity: string; durationMin: number }
const DAY_NAMES = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE']

// Semaine type : ligne des jours (« ATHLÈTE »), ligne des activités juste en dessous, ligne « DURÉE STANDARD »
export function parseTemplate(rows: Rows): TemplateActivity[] {
  const header = rows.findIndex(r => r[1]?.trim() === 'ATHLÈTE')
  const durations = rows.findIndex(r => /DURÉE STANDARD/i.test(r[1] ?? ''))
  if (header < 0 || durations < 0) throw new Error('PLANNING_CHARGES : lignes « ATHLÈTE » ou « DURÉE STANDARD » introuvables')
  const template: TemplateActivity[] = []
  let day = -1
  for (let c = 2; c < rows[header].length; c++) {
    const label = rows[header][c]?.trim().toUpperCase()
    if (label) {
      day = DAY_NAMES.indexOf(label)
      if (day < 0) break // « TOTAL HEBDO » : fin des jours
    }
    const activity = rows[header + 1][c]?.trim()
    const durationMin = Number(rows[durations][c])
    if (activity && durationMin > 0) template.push({ day, activity, durationMin })
  }
  return template
}

// Lignes joueurs : POSTE | ATHLÈTE, entre la ligne « DURÉE STANDARD » et « MOYENNE GROUPE »
export function parsePositions(rows: Rows): { playerKey: string; position: string }[] {
  const start = rows.findIndex(r => /DURÉE STANDARD/i.test(r[1] ?? ''))
  if (start < 0) throw new Error('PLANNING_CHARGES : ligne « DURÉE STANDARD » introuvable')
  const players = []
  for (const r of rows.slice(start + 1)) {
    if (/MOYENNE/i.test(r[0] ?? '')) break
    if (r[0]?.trim() && r[1]?.trim()) players.push({ playerKey: nameKey(r[1]), position: r[0].trim() })
  }
  return players
}

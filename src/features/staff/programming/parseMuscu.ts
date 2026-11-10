// Fiche « <Joueur> : PER MUSCULATION » : un onglet C<cycle>S<semaine> par semaine, un bloc « Lundi : »… par jour.
// Colonnes repérées par leur titre : bloc | exercice | séries | reps | charge | tempo | repos (facultatif) | RPE | charge faite | statut | commentaire
import * as XLSX from 'xlsx'
import { nameKey, weekStart } from '../../../lib/names'
import { addDays } from '../../../lib/week'

// Erreur de saisie connue dans une fiche, corrigée à l'import sans toucher au classeur (data/import/corrections.csv)
export type Correction = { player: string; sheet: string; exercise: string; rpe: string; doneLoad: string }

export function parseCorrections(csv: string): Correction[] {
  return csv.split(/\r?\n/).slice(1).filter(l => l.trim()).map(l => {
    const [player = '', sheet = '', exercise = '', rpe = '', doneLoad = ''] = l.split(';').map(s => s.trim())
    return { player, sheet, exercise, rpe, doneLoad }
  })
}

export type LoadUnit = 'pct_rm' | 'kg' | 'bw' | 'free'
export type Feedback = { rpe: number | null; doneLoad: string | null; status: 'fait' | 'partiel' | 'non fait' | null; comment: string | null }
export type MuscuExercise = {
  block: string; name: string; sets: number | null; reps: string | null
  loadValue: number | null; loadUnit: LoadUnit | null; loadText: string | null
  instructions: string | null // consigne : charge libre, référence (« 3RM », « RER »), détail MOB écrit dans Séries
  tempo: string | null; rest: string | null; feedback: Feedback | null
}
// activity : séance d'un joueur blessé, d'après l'en-tête du jour (« Lundi RÉHAB : », « Lundi MEMBRES SAINS : ») ; sinon Musculation
export type MuscuSession = { date: string; activity?: 'Réhabilitation' | 'Membres sains'; focus?: string; exercises: MuscuExercise[] }
export const sessionActivity = (header: string): MuscuSession['activity'] =>
  /r[ée]hab/i.test(header) ? 'Réhabilitation' : /membres?\s*sains?/i.test(header) ? 'Membres sains' : undefined

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
// Intitulé écrit sur la ligne du jour : « Lundi - Puissance BDC », « Mardi : Force HDC », « Lundi (Force & Squat) »,
// « Lundi RÉHAB : Genou » ; sans texte après le jour (« Lundi : ») : pas d'intitulé
export const dayFocus = (header: string) => header.trim()
  .replace(new RegExp(`^(${DAYS.join('|')})\\b`, 'i'), '')
  .replace(/r[ée]hab(ilitation)?|membres?\s*sains?/gi, '')
  .replace(/^[\s:\-–—()]+|[\s:\-–—()]+$/g, '').replace(/\s+/g, ' ').trim() || undefined
const BLOCK = /^(MOB|F|[A-Z]\d+)$/
const text = (v: string | undefined) => v?.replace(/\s+/g, ' ').trim() || null
// Onglet semaine : « C2S1 », « C1S4 », « CYCLE 2 S1 » ; le numéro de semaine compte depuis la semaine 1 donnée au lecteur
export const WEEK_SHEET = /^C(?:YCLE)?\s*(\d+)\s*S\s*([1-9]\d*)$/i

export function parseLoad(raw: string | null): { loadValue: number | null; loadUnit: LoadUnit | null; note?: string } {
  const t = raw?.replace(',', '.').trim()
  if (!t) return { loadValue: null, loadUnit: null }
  if (/^PDC$/i.test(t)) return { loadValue: null, loadUnit: 'bw' }
  // Un seul pourcentage, éventuellement « %3RM » (= %RM : les tests de référence sont des 3RM), suivi ou non d'une précision
  // (« 90%3RM 3 RER ») : charge en %RM, la précision seule reste en consigne. Plusieurs % (pyramide) : libre, texte intact.
  const pct = t.match(/^(\d+(?:\.\d+)?)\s*%\s*(\d*)\s*(RM)?/i)
  if (pct && (t.match(/%/g) ?? []).length === 1 && !/PDC/i.test(t)) {
    // Consigne = ce qui suit « N%RM » (« 3 RER », « Front Squat ») : jamais le % lui-même, que la duplication fait progresser.
    // Une autre référence que la 3RM (« 5RM ») reste en consigne.
    const ref = pct[3] && pct[2] && pct[2] !== '3' ? `${pct[2]}RM` : null
    const rest = (pct[3] ? t.slice(pct[0].length) : t.slice(t.indexOf('%') + 1)).replace(/\s+/g, ' ').trim()
    const note = [ref, rest].filter(Boolean).join(' ')
    return { loadValue: Number(pct[1]), loadUnit: 'pct_rm', ...(note ? { note } : {}) }
  }
  let m = t.match(/^(\d+(?:\.\d+)?)\s*%\s*PDC$/i)
  if (m) return { loadValue: Number(m[1]), loadUnit: 'bw' }
  m = t.match(/^(\d+(?:\.\d+)?)\s*%$/)
  if (m) return { loadValue: Number(m[1]), loadUnit: 'pct_rm' }
  m = t.match(/^(\d+(?:\.\d+)?)\s*(kg)?$/i)
  if (m) return { loadValue: Number(m[1]), loadUnit: 'kg' }
  return { loadValue: null, loadUnit: 'free' } // « à toi de voir » : le texte reste dans les consignes
}

function parseFeedback(rpe: string | null, doneLoad: string | null, status: string | null, comment: string | null, where: string): Feedback | null {
  const rpeValue = rpe !== null && /^\d+([.,]\d+)?$/.test(rpe) ? Number(rpe.replace(',', '.')) : null
  if (rpeValue !== null && rpeValue > 10) throw new Error(`${where} : RPE ${rpe} hors de l'échelle 0-10, à corriger dans la fiche`)
  const statusValue = ({ 'fait': 'fait', 'non fait': 'non fait', 'partiel': 'partiel' } as const)[status?.toLowerCase() ?? ''] ?? null
  if (rpeValue === null && !doneLoad && !statusValue && !comment) return null
  return { rpe: rpeValue, doneLoad, status: statusValue, comment }
}

// Cellules fusionnées verticalement (repos commun à A1/A2…) : la valeur vaut pour chaque ligne
function fillVerticalMerges(ws: XLSX.WorkSheet) {
  for (const m of ws['!merges'] ?? []) {
    if (m.s.c !== m.e.c) continue
    const top = ws[XLSX.utils.encode_cell(m.s)]
    for (let r = m.s.r + 1; r <= m.e.r; r++) if (top) ws[XLSX.utils.encode_cell({ r, c: m.s.c })] = { ...top }
  }
}

// feedback: false (import depuis l'app) : colonnes de retour facultatives et jamais lues — un vieux RPE faux ne bloque rien
export function parseMuscuSheet(
  ws: XLSX.WorkSheet, sheetName: string, seasonStart: string, corrections: Correction[] = [], { feedback = true } = {},
): { playerName: string; sessions: MuscuSession[] } {
  const week = sheetName.trim().match(WEEK_SHEET)
  if (!week) throw new Error(`onglet « ${sheetName} » : nom attendu C<cycle>S<semaine> ou CYCLE <n> S<semaine>`)
  const monday = weekStart(seasonStart, Number(week[2]))

  fillVerticalMerges(ws)
  const all = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false, blankrows: true })
  // La colonne « Exercice » de l'en-tête porte le bloc : on s'y aligne plutôt que sur la première colonne remplie
  const headerRow = all.find(r => r.some(c => c.trim() === 'Exercice'))
  if (!headerRow) throw new Error(`onglet ${sheetName} : en-tête « Exercice » introuvable`)
  const offset = headerRow.findIndex(c => c.trim() === 'Exercice')
  const rows = all.map(r => r.slice(offset))
  // Les fiches n'ont pas toutes les mêmes colonnes (« Repos » absent de certaines) : chaque colonne est repérée par son titre
  const header = headerRow.slice(offset).map(c => c.trim())
  const col = (title: RegExp, required = true) => {
    const i = header.findIndex(c => title.test(c))
    if (i < 0 && required) throw new Error(`onglet ${sheetName} : colonne ${title} introuvable dans l'en-tête`)
    return i
  }
  const c = {
    sets: col(/^s[ée]ries/i), reps: col(/^r[ée]p[ée]titions/i), load: col(/^charge \(/i, false), tempo: col(/^tempo/i, false),
    rest: col(/^repos/i, false), rpe: col(/^rpe/i, feedback), done: col(/^charge$/i, false), status: col(/^statut/i, feedback), comment: col(/^commentaire/i, false),
  }
  const cell = (r: string[], i: number) => (i < 0 ? null : text(r[i]))
  // Ligne 3 : « Prénom NOM » sous le titre « Séance PER - Semaine N »
  const playerName = rows.slice(0, 6).map(r => text(r[1])).find(v => v && !/séance/i.test(v))
  if (!playerName) throw new Error(`onglet ${sheetName} : nom du joueur introuvable`)

  const sessions: MuscuSession[] = []
  for (const r of rows) {
    const day = DAYS.findIndex(d => new RegExp(`^${d}\\b`, 'i').test(r[0]?.trim() ?? ''))
    if (day >= 0) { sessions.push({ date: addDays(monday, day), activity: sessionActivity(r[0]), focus: dayFocus(r[0]), exercises: [] }); continue }
    const block = r[0]?.trim() ?? ''
    const name = text(r[1])
    if (!BLOCK.test(block) || !name || !sessions.length) continue
    const loadText = cell(r, c.load)
    const sets = cell(r, c.sets)
    const load = parseLoad(loadText)
    const fix = corrections.find(f => nameKey(f.player) === nameKey(playerName) && f.sheet === sheetName && f.exercise === name)
    sessions.at(-1)!.exercises.push({
      block, name,
      sets: sets && /^\d+$/.test(sets) ? Number(sets) : null,
      instructions: [sets && !/^\d+$/.test(sets) ? sets : null, load.loadUnit === 'free' ? loadText : load.note ?? null].filter(Boolean).join(' · ') || null,
      reps: cell(r, c.reps),
      loadValue: load.loadValue, loadUnit: load.loadUnit, loadText,
      tempo: cell(r, c.tempo), rest: cell(r, c.rest),
      feedback: feedback ? parseFeedback(fix ? fix.rpe : cell(r, c.rpe), fix ? fix.doneLoad : cell(r, c.done),
        cell(r, c.status), cell(r, c.comment), `${playerName} ${sheetName} ${name}`) : null,
    })
  }
  return { playerName, sessions: sessions.filter(s => s.exercises.length) }
}

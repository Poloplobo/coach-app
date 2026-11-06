// Import d'une fiche « Prénom NOM_PER MUSCULATION.xlsx » depuis l'app, en début de cycle : séances (onglets « C2S1 »,
// « CYCLE 2 S1 »… : Sn = n-ième semaine du cycle, datée depuis la semaine 1 choisie à l'import)
// et objectifs chiffrés (onglet OBJECTIFS : Test | Objectif | Libellé). Lu dans le navigateur, rien n'est envoyé ailleurs.
// Chargé seulement à l'import (xlsx est lourd). Les retours éventuellement présents dans la fiche sont ignorés.
import * as XLSX from 'xlsx'
import { nameKey } from '../../../lib/names'
import { addDays, parisDate } from '../../../lib/week'
import { WEEK_SHEET, parseMuscuSheet } from './parseMuscu'

type Week = { code: string; start_date: string }
type Player = { id: string; first_name: string; last_name: string; import_name: string | null }
type TestDef = { id: string; name: string }

export type ImportExercise = {
  name: string; block_label: string; sets: number | null; reps: string | null; load_value: number | null
  load_unit: string | null; tempo: string | null; rest: string | null; instructions: string | null
}
export type ProgramPreview = {
  playerName: string | null; player: Player | null
  sessions: { date: string; activity?: string; week: string; exercises: ImportExercise[] }[]
  targets: { test: string; test_id: string; value: number; label: string | null }[]
  newExercises: string[]; errors: string[]
  warnings: string[] // à vérifier, non bloquant
  past: number // séances de jours passés (anciens onglets) : ignorées
}

const lower = (s: string) => s.trim().toLowerCase()

export function readProgram(
  data: ArrayBuffer, ctx: { weeks: Week[]; players: Player[]; tests: TestDef[]; library: string[]; cycleStart: string }, fileName = '',
): ProgramPreview {
  const wb = XLSX.read(data)
  const errors: string[] = []
  const preview: ProgramPreview = { playerName: null, player: null, sessions: [], targets: [], newExercises: [], errors, warnings: [], past: 0 }
  const today = parisDate()

  const weekSheets = wb.SheetNames.filter(n => WEEK_SHEET.test(n.trim()))
  if (!weekSheets.length) errors.push('Aucun onglet semaine (nommé C<cycle>S<semaine> ou CYCLE <n> S<semaine>, ex. CYCLE 2 S1).')

  // Chaque Sn est daté depuis la semaine 1 choisie : deux onglets de même numéro (ancien cycle laissé dans la fiche)
  // tomberaient sur la même semaine. Bloqué ; des numéros de cycle différents sont seulement signalés (coquille « C1S4 »).
  const parsed = weekSheets.map(sheet => { const m = sheet.trim().match(WEEK_SHEET)!; return { sheet, cycle: Number(m[1]), n: Number(m[2]) } })
  for (const n of new Set(parsed.map(p => p.n))) {
    const same = parsed.filter(p => p.n === n)
    if (same.length > 1) errors.push(`Onglets ${same.map(p => `« ${p.sheet} »`).join(' et ')} : même semaine ${n} du cycle. Retire les onglets de l'ancien cycle de la fiche.`)
  }
  const cycles = [...new Set(parsed.map(p => p.cycle))]
  if (cycles.length > 1) preview.warnings.push(`Onglets de cycles différents (${parsed.map(p => p.sheet).join(', ')}) : tous sont datés depuis la semaine 1 choisie. Vérifie qu'aucun n'appartient à un ancien cycle.`)

  const names = new Set<string>()
  for (const { sheet, n } of parsed) {
    // Le numéro de cycle de l'onglet n'est pas lu (une coquille « C1S4 » pour C2S4 est courante) : seul Sn compte
    const monday = addDays(ctx.cycleStart, 7 * (n - 1))
    try {
      const { playerName, sessions } = parseMuscuSheet(wb.Sheets[sheet], sheet, ctx.cycleStart, [], { feedback: false })
      names.add(playerName)
      const code = ctx.weeks.find(w => w.start_date === monday)?.code ?? `hors calendrier (semaine du ${monday})`
      for (const s of sessions) {
        if (s.date < today) { preview.past++; continue }
        const exercises = s.exercises.map(e => ({
          name: e.name, block_label: e.block, sets: e.sets, reps: e.reps, load_value: e.loadValue, load_unit: e.loadUnit,
          tempo: e.tempo, rest: e.rest, instructions: e.instructions,
        }))
        // Deux blocs du même jour et de la même activité (« Lundi matin », « Lundi soir ») : une seule séance, exercices mis
        // bout à bout. Blessé : « Lundi RÉHAB » et « Lundi MEMBRES SAINS » restent deux séances. Deux onglets de même semaine
        // restent bloqués plus haut.
        const sameDay = preview.sessions.find(x => x.date === s.date && x.activity === s.activity)
        if (sameDay) sameDay.exercises.push(...exercises)
        else preview.sessions.push({ date: s.date, activity: s.activity, week: `S${n} du cycle · ${code}`, exercises })
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  if (names.size > 1) errors.push(`Plusieurs joueurs dans la fiche : ${[...names].join(', ')}.`)
  preview.playerName = [...names][0] ?? null
  if (preview.playerName) {
    const key = nameKey(preview.playerName)
    // Fiche copiée d'un autre joueur sans changer le nom : on écrirait chez le mauvais joueur
    const fromFile = fileName.match(/^(.+?)_PER/i)?.[1]
    if (fromFile && nameKey(fromFile) !== key) errors.push(`Le fichier est au nom de « ${fromFile} » mais la fiche indique « ${preview.playerName} » : corrige l'un des deux.`)
    const matches = ctx.players.filter(p => nameKey(p.import_name ?? '') === key || nameKey(`${p.first_name} ${p.last_name}`) === key)
    if (matches.length > 1) errors.push(`« ${preview.playerName} » correspond à plusieurs joueurs de l'effectif.`)
    preview.player = matches.length === 1 ? matches[0] : null
    if (!matches.length) errors.push(`Joueur « ${preview.playerName} » introuvable dans l'effectif.`)
  }

  // Objectifs facultatifs : un onglet mal formé ne bloque jamais l'import des séances (avertissement, lignes valides gardées)
  const objectives = wb.SheetNames.find(n => /^objectifs$/i.test(n.trim()))
  if (objectives) {
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[objectives], { header: 1, defval: '', raw: false })
    const h = rows.findIndex(r => r.some(c => /^test$/i.test(String(c).trim())))
    if (h < 0) preview.warnings.push('OBJECTIFS non importés : l\'onglet n\'est pas un tableau « Test | Objectif | Libellé » (texte libre ?). Les séances, elles, sont importées.')
    else {
      const col = (re: RegExp) => rows[h].findIndex(c => re.test(String(c).trim()))
      const [test, value, label] = [col(/^test$/i), col(/^objectif$/i), col(/^libell[ée]$/i)]
      if (value < 0) preview.warnings.push('OBJECTIFS non importés : colonne « Objectif » introuvable.')
      else rows.slice(h + 1).forEach((r, i) => {
        const name = String(r[test] ?? '').trim()
        if (!name) return
        const raw = String(r[value] ?? '').trim().replace(',', '.')
        const def = ctx.tests.find(t => lower(t.name) === lower(name))
        if (!raw || !Number.isFinite(Number(raw))) preview.warnings.push(`OBJECTIFS ligne ${h + i + 2} non importée : objectif illisible « ${r[value] ?? ''} ».`)
        else if (!def) preview.warnings.push(`OBJECTIFS ligne ${h + i + 2} non importée : test « ${name} » inconnu (tests : ${ctx.tests.map(t => t.name).join(', ')}).`)
        else if (preview.targets.some(t => t.test_id === def.id)) preview.warnings.push(`OBJECTIFS : test « ${def.name} » en double, seule la première ligne est importée.`)
        else preview.targets.push({ test: def.name, test_id: def.id, value: Number(raw), label: label >= 0 ? String(r[label] ?? '').trim() || null : null })
      })
    }
  }

  const known = new Set(ctx.library.map(lower))
  preview.newExercises = [...new Map(preview.sessions.flatMap(s => s.exercises)
    .filter(e => !known.has(lower(e.name))).map(e => [lower(e.name), e.name])).values()]
  if (!preview.sessions.length && !errors.length) errors.push(preview.past ? 'Toutes les séances de la fiche sont passées : ajoute l\'onglet du nouveau cycle.' : 'Aucune séance trouvée dans la fiche.')
  return preview
}


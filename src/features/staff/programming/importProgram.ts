// Import d'une fiche « Prénom NOM_PER MUSCULATION.xlsx » depuis l'app, en début de cycle : séances (onglets C<cycle>S<semaine>)
// et objectifs chiffrés (onglet OBJECTIFS : Test | Objectif | Libellé). Lu dans le navigateur, rien n'est envoyé ailleurs.
// Chargé seulement à l'import (xlsx est lourd). Les retours éventuellement présents dans la fiche sont ignorés.
import * as XLSX from 'xlsx'
import { nameKey } from '../../../lib/names'
import { addDays, parisDate } from '../../../lib/week'
import { parseMuscuSheet } from './parseMuscu'

type Week = { code: string; start_date: string }
type Player = { id: string; first_name: string; last_name: string; import_name: string | null }
type TestDef = { id: string; name: string }

export type ImportExercise = {
  name: string; block_label: string; sets: number | null; reps: string | null; load_value: number | null
  load_unit: string | null; tempo: string | null; rest: string | null; instructions: string | null
}
export type ProgramPreview = {
  playerName: string | null; player: Player | null
  sessions: { date: string; week: string; exercises: ImportExercise[] }[]
  targets: { test: string; test_id: string; value: number; label: string | null }[]
  newExercises: string[]; errors: string[]
  past: number // séances de jours passés (anciens onglets) : ignorées
}

const lower = (s: string) => s.trim().toLowerCase()

export function readProgram(
  data: ArrayBuffer, ctx: { weeks: Week[]; players: Player[]; tests: TestDef[]; library: string[] }, fileName = '',
): ProgramPreview {
  const wb = XLSX.read(data)
  const errors: string[] = []
  const preview: ProgramPreview = { playerName: null, player: null, sessions: [], targets: [], newExercises: [], errors, past: 0 }
  const today = parisDate()

  const weekSheets = wb.SheetNames.filter(n => /^C\d+S\d+$/.test(n))
  if (!weekSheets.length) errors.push('Aucun onglet semaine (nommé C<cycle>S<semaine>, ex. C2S7).')

  const names = new Set<string>()
  for (const sheet of weekSheets) {
    const n = Number(sheet.match(/S(\d+)$/)![1])
    const week = ctx.weeks.find(w => w.code === `S${n}`)
    if (!week) { errors.push(`${sheet} : S${n} absente du calendrier (à créer dans Semaines).`); continue }
    try {
      // Datée sur le lundi de Sn au calendrier (et non S1 + 7 jours par semaine) ; retours de la fiche jamais lus
      const { playerName, sessions } = parseMuscuSheet(wb.Sheets[sheet], sheet, addDays(week.start_date, -7 * (n - 1)), [], { feedback: false })
      names.add(playerName)
      const code = week.code
      for (const s of sessions) if (s.date < today) preview.past++; else preview.sessions.push({
        date: s.date, week: code,
        exercises: s.exercises.map(e => ({
          name: e.name, block_label: e.block, sets: e.sets, reps: e.reps, load_value: e.loadValue, load_unit: e.loadUnit,
          tempo: e.tempo, rest: e.rest, instructions: e.loadUnit === 'free' ? e.loadText : null,
        })),
      })
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
  const dates = preview.sessions.map(s => s.date)
  for (const d of new Set(dates.filter((d, i) => dates.indexOf(d) !== i))) errors.push(`Deux séances le même jour (${d}) : un seul bloc par jour et une seule fois chaque semaine.`)

  const objectives = wb.SheetNames.find(n => /^objectifs$/i.test(n.trim()))
  if (objectives) {
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[objectives], { header: 1, defval: '', raw: false })
    const h = rows.findIndex(r => r.some(c => /^test$/i.test(String(c).trim())))
    if (h < 0) errors.push('OBJECTIFS : en-tête « Test | Objectif | Libellé » introuvable.')
    else {
      const col = (re: RegExp) => rows[h].findIndex(c => re.test(String(c).trim()))
      const [test, value, label] = [col(/^test$/i), col(/^objectif$/i), col(/^libell[ée]$/i)]
      if (value < 0) errors.push('OBJECTIFS : colonne « Objectif » introuvable.')
      else rows.slice(h + 1).forEach((r, i) => {
        const name = String(r[test] ?? '').trim()
        if (!name) return
        const raw = String(r[value] ?? '').trim().replace(',', '.')
        const def = ctx.tests.find(t => lower(t.name) === lower(name))
        if (!raw || !Number.isFinite(Number(raw))) errors.push(`OBJECTIFS ligne ${h + i + 2} : objectif illisible « ${r[value] ?? ''} ».`)
        else if (!def) errors.push(`OBJECTIFS ligne ${h + i + 2} : test « ${name} » inconnu (tests : ${ctx.tests.map(t => t.name).join(', ')}).`)
        else if (preview.targets.some(t => t.test_id === def.id)) errors.push(`OBJECTIFS : test « ${def.name} » en double.`)
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


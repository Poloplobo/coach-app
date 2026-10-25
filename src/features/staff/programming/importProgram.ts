// Import d'une fiche « Prénom NOM_PER MUSCULATION.xlsx » depuis l'app, en début de cycle : séances (onglets C<cycle>S<semaine>)
// et objectifs chiffrés (onglet OBJECTIFS : Test | Objectif | Libellé). Lu dans le navigateur, rien n'est envoyé ailleurs.
// Chargé seulement à l'import (xlsx est lourd). Les retours éventuellement présents dans la fiche sont ignorés.
import * as XLSX from 'xlsx'
import { nameKey } from '../../../lib/names'
import { addDays } from '../../../lib/week'
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
}

const lower = (s: string) => s.trim().toLowerCase()

export function readProgram(data: ArrayBuffer, ctx: { weeks: Week[]; players: Player[]; tests: TestDef[]; library: string[] }): ProgramPreview {
  const wb = XLSX.read(data)
  const errors: string[] = []
  const preview: ProgramPreview = { playerName: null, player: null, sessions: [], targets: [], newExercises: [], errors }

  const s1 = ctx.weeks.find(w => w.code === 'S1')
  const weekSheets = wb.SheetNames.filter(n => /^C\d+S\d+$/.test(n))
  if (!weekSheets.length) errors.push('Aucun onglet semaine (nommé C<cycle>S<semaine>, ex. C2S7).')
  if (!s1) errors.push('S1 absente du calendrier : impossible de dater les séances.')

  const names = new Set<string>()
  for (const sheet of s1 ? weekSheets : []) {
    try {
      const { playerName, sessions } = parseMuscuSheet(wb.Sheets[sheet], sheet, s1!.start_date)
      names.add(playerName)
      const code = `S${sheet.match(/S(\d+)$/)![1]}`
      // La fiche compte les semaines depuis S1 : la semaine doit exister au calendrier, au même lundi
      const week = ctx.weeks.find(w => w.code === code)
      if (!week || (sessions[0] && (sessions[0].date < week.start_date || sessions[0].date > addDays(week.start_date, 6)))) {
        errors.push(`${sheet} : ${code} absente du calendrier (à créer dans Semaines).`)
        continue
      }
      for (const s of sessions) preview.sessions.push({
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
    preview.player = ctx.players.find(p => nameKey(p.import_name ?? '') === key || nameKey(`${p.first_name} ${p.last_name}`) === key) ?? null
    if (!preview.player) errors.push(`Joueur « ${preview.playerName} » introuvable dans l'effectif.`)
  }

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
        if (!raw || Number.isNaN(Number(raw))) errors.push(`OBJECTIFS ligne ${h + i + 2} : objectif illisible « ${r[value] ?? ''} ».`)
        else if (!def) errors.push(`OBJECTIFS ligne ${h + i + 2} : test « ${name} » inconnu (tests : ${ctx.tests.map(t => t.name).join(', ')}).`)
        else preview.targets.push({ test: def.name, test_id: def.id, value: Number(raw), label: label >= 0 ? String(r[label] ?? '').trim() || null : null })
      })
    }
  }

  const known = new Set(ctx.library.map(lower))
  preview.newExercises = [...new Map(preview.sessions.flatMap(s => s.exercises)
    .filter(e => !known.has(lower(e.name))).map(e => [lower(e.name), e.name])).values()]
  if (!preview.sessions.length && !errors.length) errors.push('Aucune séance trouvée dans la fiche.')
  return preview
}


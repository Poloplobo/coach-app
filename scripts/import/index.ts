// Importe l'historique PER dans Supabase depuis data/import/.
// Usage : npm run import -- [--dry-run]
// Utilise la clé secrète (Mac de l'admin uniquement, comme create-accounts). Relançable : tout passe par des upserts.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/database.types'
import { addDays, nameKey, weekStart } from './names'
import { parseRpe } from './parseRpe'
import { parsePositions, parseTemplate, parseWeeks } from './parseChargePer'
import { parseCorrections, parseMuscuSheet } from './parseMuscu'
import { parseTestsCsv } from './parseTests'
import { parseTargets } from './parseTargets'

const DIR = 'data/import'
const SEASON_START = '2026-09-14' // lundi de S1 (déduit des réponses : CONFIG_SEMAINES_PER ne donne aucune date)
const TEST_DATE = SEASON_START    // les tests P1 ne sont pas datés : décision du 23/10/2026
const GROUP = { name: 'PER 2026/27', season: '2026-2027' }
// Orthographes différentes d'un même joueur : data/import/alias.csv, une ligne « nom dans le classeur;nom du compte »
const ALIASES = existsSync(`${DIR}/alias.csv`)
  ? readFileSync(`${DIR}/alias.csv`, 'utf8').split(/\r?\n/).filter(l => l.includes(';')).map(l => l.split(';').map(s => s.trim()))
  : []

const dryRun = process.argv.includes('--dry-run')
// Depuis l'étape 6, l'app est la seule source de la programmation : semaines, planning du groupe et programmes muscu
// ne sont repris des classeurs qu'à la demande (reprise exceptionnelle), sinon ils écraseraient le travail fait dans l'app
const withPrograms = process.argv.includes('--programmes')
const url = process.env.VITE_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
if (!url || !secretKey) throw new Error('Ajoute VITE_SUPABASE_URL et SUPABASE_SECRET_KEY dans .env.local')
const db = createClient<Database>(url, secretKey, { auth: { persistSession: false } })

const must = <T>({ data, error }: { data: T; error: { message: string } | null }, what: string): NonNullable<T> => {
  if (error || data == null) throw new Error(`${what} : ${error?.message ?? 'aucune donnée'}`)
  return data as NonNullable<T>
}

// ---------- Lecture et contrôle des fichiers (aucune écriture) ----------

const sheetRows = (wb: XLSX.WorkBook, name: string) => {
  const ws = wb.Sheets[name]
  if (!ws) throw new Error(`onglet ${name} introuvable`)
  return XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false })
}
const chargePer = XLSX.read(readFileSync(`${DIR}/charge-per.xlsx`))
const weeks = parseWeeks(sheetRows(chargePer, 'CONFIG_SEMAINES_PER'), SEASON_START)
const positions = parsePositions(sheetRows(chargePer, 'PLANNING_CHARGES'))
// La musculation est individuelle : elle vient des fiches muscu, pas de la semaine type du groupe
const template = parseTemplate(sheetRows(chargePer, 'PLANNING_CHARGES')).filter(t => t.activity !== 'Musculation')
const rpe = parseRpe(JSON.parse(readFileSync(`${DIR}/rpe_historique.json`, 'utf8')))
const tests = parseTestsCsv(readFileSync(`${DIR}/tests-per.csv`, 'utf8'))
// Erreurs de saisie connues dans les fiches : data/import/corrections.csv « Joueur;Onglet;Exercice;RPE;Charge réalisée »
const corrections = existsSync(`${DIR}/corrections.csv`) ? parseCorrections(readFileSync(`${DIR}/corrections.csv`, 'utf8')) : []
const muscu = readdirSync(`${DIR}/muscu`).filter(f => f.endsWith('.xlsx')).flatMap(file => {
  const wb = XLSX.read(readFileSync(`${DIR}/muscu/${file}`))
  return wb.SheetNames.filter(n => /^C\d+S\d+$/.test(n)).map(n => ({ file, sheet: n, ...parseMuscuSheet(wb.Sheets[n], n, SEASON_START, corrections) }))
})
// Objectifs chiffrés : facultatif tant que la feuille n'est pas déposée
const targetsWb = existsSync(`${DIR}/objectifs.xlsx`) ? XLSX.read(readFileSync(`${DIR}/objectifs.xlsx`)) : null
const targets = targetsWb
  ? parseTargets(sheetRows(targetsWb, targetsWb.SheetNames.find(n => /^objectifs$/i.test(n.trim())) ?? targetsWb.SheetNames[0]))
  : []

const profiles = must(await db.from('profiles').select('id, import_name').eq('role', 'player'), 'profils')
const playerByKey = new Map<string, string>()
for (const p of profiles.filter(p => p.import_name)) {
  const key = nameKey(p.import_name!)
  if (playerByKey.has(key)) throw new Error(`deux joueurs ont le même nom une fois normalisé : « ${p.import_name} »`)
  playerByKey.set(key, p.id)
}
const activityByName = new Map(must(await db.from('activity_types').select('id, name'), 'activités').map(a => [a.name, a.id]))
const testByName = new Map(must(await db.from('test_definitions').select('id, name'), 'tests').map(t => [t.name, t.id]))

// Nom inconnu = ligne rejetée et listée, jamais de création silencieuse
const rejects = new Set<string>()
const aliasByKey = new Map(ALIASES.map(([from, to]) => [nameKey(from), nameKey(to)]))
const player = (name: string, source: string) => {
  const key = nameKey(name)
  const id = playerByKey.get(aliasByKey.get(key) ?? key)
  if (!id) rejects.add(`${source} : joueur inconnu « ${name} »`)
  return id
}
const activity = (name: string) => {
  const id = activityByName.get(name)
  if (!id) throw new Error(`activité inconnue « ${name} » : à ajouter dans activity_types`)
  return id
}
const testId = (name: string) => {
  const id = testByName.get(name)
  if (!id) throw new Error(`test inconnu « ${name} ». Noms acceptés : ${[...testByName.keys()].sort().join(', ')}`)
  return id
}

// Semaine type générée pour les semaines en cours et à venir ; les semaines passées gardent leur historique réel
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
const upcoming = weeks.filter(w => addDays(w.startDate, 6) >= today)
const groupPlan = upcoming.filter(w => !w.off).flatMap(w => template.map(t => ({
  session_date: addDays(w.startDate, t.day), title: t.activity, activity_type_id: activity(t.activity), planned_duration_min: t.durationMin,
})))

const members = positions.flatMap(p => { const id = player(p.playerKey, 'PLANNING_CHARGES'); return id ? [{ id, position: p.position }] : [] })
const logs = rpe.logs.flatMap(l => {
  const player_id = player(l.playerKey, 'rpe_historique.json')
  return player_id ? [{
    player_id, session_date: l.date, activity_type_id: activity(l.activity), duration_min: l.durationMin,
    rpe: l.rpe, source: 'import_form', validated_at: l.validatedAt,
  }] : []
})
const muscuSessions = muscu.flatMap(m => {
  const player_id = player(m.playerName, `muscu/${m.file} ${m.sheet}`)
  return player_id ? m.sessions.map(s => ({ player_id, ...s })) : []
})
const testRows = tests.results.flatMap(t => {
  const player_id = player(t.importName, 'tests-per.csv')
  return player_id ? [{ player_id, test_id: testId(t.test), test_date: TEST_DATE, period: t.period, value: t.value }] : []
})
const bodyRows = tests.measurements.flatMap(m => {
  const player_id = player(m.importName, 'tests-per.csv')
  return player_id ? [{ player_id, measured_on: TEST_DATE, height_cm: m.heightCm, weight_kg: m.weightKg }] : []
})
const targetRows = targets.flatMap(t => {
  const player_id = player(t.playerName, 'objectifs.xlsx')
  return player_id ? [{ player_id, season: GROUP.season, test_id: testId(t.test), target_value: t.value, label: t.label }] : []
})

console.log(`Semaines : ${weeks.length} (${weeks[0].code} = ${weeks[0].startDate})`)
console.log(`Joueurs du groupe ${GROUP.name} : ${members.length}`)
console.log(`Semaine type (${template.length} activités hors muscu) générée pour : ` +
  `${upcoming.map(w => w.off ? `${w.code} (OFF, rien)` : w.code).join(', ') || 'aucune semaine à venir dans CONFIG_SEMAINES_PER'}`)
console.log(`RPE : ${logs.length} activités (${rpe.skipped} réponses écartées : statut différent de « ok »)`)
console.log(`Musculation : ${muscuSessions.length} séances, ${muscuSessions.reduce((n, s) => n + s.exercises.length, 0)} exercices, ` +
  `${muscuSessions.reduce((n, s) => n + s.exercises.filter(e => e.feedback).length, 0)} retours`)
console.log(`Tests : ${testRows.length} résultats, ${bodyRows.length} mesures taille / poids`)
console.log(targetsWb ? `Objectifs : ${targetRows.length}` : 'Objectifs : data/import/objectifs.xlsx absent, rien à importer')
if (rejects.size) console.log(`\nRejetés (non importés) :\n  ${[...rejects].join('\n  ')}`)
if (!withPrograms) console.log('\nSemaines, planning et programmes muscu : non repris (l\'app fait foi ; --programmes pour une reprise)')
if (dryRun) { console.log('\nSimulation : rien n\'a été écrit.'); process.exit(0) }
// Écriture réelle : il faut nommer la base visée, pour ne jamais écrire en production par erreur
const target = new URL(url).hostname.split('.')[0]
if (!process.argv.includes(`--confirm=${target}`)) {
  console.log(`\nRien n'a été écrit. Pour écrire dans la base « ${target} », relance avec : -- --confirm=${target}`)
  process.exit(1)
}

// ---------- Écriture ----------

const group = must(await db.from('groups').upsert(GROUP, { onConflict: 'name' }).select('id').single(), 'groupe')
must(await db.from('group_members').upsert(members.map(m => ({ group_id: group.id, player_id: m.id })), { onConflict: 'group_id,player_id' }).select(), 'membres')
for (const m of members) must(await db.from('profiles').update({ position: m.position }).eq('id', m.id).select(), 'poste')

if (withPrograms) {
  const cycles = [...new Set(weeks.map(w => w.cycle).filter(Boolean))]
  must(await db.from('cycles').upsert(cycles.map(name => ({ group_id: group.id, name })), { onConflict: 'group_id,name' }).select(), 'cycles')
  must(await db.from('season_weeks').upsert(weeks.map(w => ({
    group_id: group.id, code: w.code, label: w.label, start_date: w.startDate,
    week_type_code: w.weekType, cycle: w.cycle, phase_note: w.note || null,
  })), { onConflict: 'group_id,code' }).select(), 'semaines')

  // shortcut: une activité retirée de la semaine type reste planifiée dans les semaines déjà générées ; le staff la supprimera à l'étape 6
  must(await db.from('planned_sessions').upsert(groupPlan.map(p => ({ ...p, group_id: group.id })),
    { onConflict: 'session_date,group_id,player_id,activity_type_id,title' }).select(), 'semaine type')
  // Une semaine passée en OFF après coup perd ses séances de groupe
  for (const w of upcoming.filter(w => w.off)) {
    must(await db.from('planned_sessions').delete().eq('group_id', group.id)
      .gte('session_date', w.startDate).lte('session_date', addDays(w.startDate, 6)).select(), 'semaine OFF')
  }
}

// Saisies des joueurs : l'import complète, il ne remplace jamais une ligne existante (saisie dans l'app ou corrigée)
must(await db.from('session_logs').upsert(logs, { onConflict: 'player_id,session_date,activity_type_id', ignoreDuplicates: true }).select(), 'RPE')

if (withPrograms) {
  const exerciseNames = [...new Set(muscuSessions.flatMap(s => s.exercises.map(e => e.name)))]
  const exercises = must(await db.from('exercises').upsert(exerciseNames.map(name => ({ name })), { onConflict: 'name' }).select('id, name'), 'exercices')
  const exerciseByName = new Map(exercises.map(e => [e.name, e.id]))
  const musculation = activity('Musculation')

  for (const s of muscuSessions) {
    const session = must(await db.from('planned_sessions').upsert({
      session_date: s.date, title: 'Musculation', player_id: s.player_id, activity_type_id: musculation,
    }, { onConflict: 'session_date,group_id,player_id,activity_type_id,title' }).select('id').single(), 'séance muscu')

    const planned = must(await db.from('planned_exercises').upsert(s.exercises.map((e, i) => ({
      planned_session_id: session.id, exercise_id: exerciseByName.get(e.name)!, position: i + 1,
      block_label: e.block, sets: e.sets, reps: e.reps, load_value: e.loadValue, load_unit: e.loadUnit,
      tempo: e.tempo, rest: e.rest, instructions: e.instructions,
    })), { onConflict: 'planned_session_id,position' }).select('id, position'), 'exercices planifiés')
    const plannedByPosition = new Map(planned.map(p => [p.position, p.id]))

    const feedback = s.exercises.flatMap((e, i) => e.feedback ? [{
      player_id: s.player_id, planned_exercise_id: plannedByPosition.get(i + 1)!,
      rpe: e.feedback.rpe, done_load: e.feedback.doneLoad, status: e.feedback.status, comment: e.feedback.comment,
    }] : [])
    if (feedback.length) {
      must(await db.from('exercise_feedback').upsert(feedback, { onConflict: 'player_id,planned_exercise_id', ignoreDuplicates: true }).select(), 'retours')
    }

    // Le RPE muscu déclaré ce jour-là devient la validation de cette séance (verrouille les retours)
    must(await db.from('session_logs').update({ planned_session_id: session.id })
      .match({ player_id: s.player_id, session_date: s.date, activity_type_id: musculation, source: 'import_form' }).select(), 'lien séance')
  }
}

// Tests et objectifs : saisis dans l'app par le staff depuis l'étape 6, l'import complète sans jamais remplacer
must(await db.from('test_results').upsert(testRows, { onConflict: 'player_id,test_id,test_date', ignoreDuplicates: true }).select(), 'tests')
if (targetRows.length) must(await db.from('player_targets').upsert(targetRows, { onConflict: 'player_id,season,test_id', ignoreDuplicates: true }).select(), 'objectifs')
must(await db.from('body_measurements').upsert(bodyRows, { onConflict: 'player_id,measured_on' }).select(), 'mesures')

// ---------- Contrôle : sRPE en base = totaux du formulaire, par joueur et par semaine ----------

const stored = must(await db.from('session_logs').select('player_id, session_date, srpe').eq('source', 'import_form'), 'contrôle')
const keyById = new Map([...playerByKey].map(([k, id]) => [id, k]))
const weekCode = (date: string) => weeks.find(w => w.startDate <= date && date < weekStart(w.startDate, 2))?.code
const actual = new Map<string, number>()
for (const l of stored) {
  const key = `${keyById.get(l.player_id)} | ${weekCode(l.session_date)}`
  actual.set(key, (actual.get(key) ?? 0) + Number(l.srpe))
}
const gaps = [...rpe.expectedTotals].filter(([key, total]) => playerByKey.has(key.split(' | ')[0]) && actual.get(key) !== total)
if (gaps.length) {
  console.error(`\nÉCART sRPE sur ${gaps.length} joueur(s)-semaine(s) :\n  ${gaps.map(([k, t]) => `${k} : formulaire ${t}, base ${actual.get(k) ?? 0}`).join('\n  ')}`)
  process.exit(1)
}
console.log('\nImport terminé. Totaux sRPE identiques au formulaire.')

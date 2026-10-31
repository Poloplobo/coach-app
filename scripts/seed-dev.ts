// Données FICTIVES pour développer et tester le tableau de bord staff, sur la base de dev uniquement (décision D10).
// Usage : npm run seed:dev   (relançable : recrée les mêmes joueurs fictifs et leurs données)
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/database.types'
import { addDays, isoWeekStart, parisDate } from '../src/lib/week'
import { generatePassword } from './players'

const DEV_REF = 'jlfbjuoqbxsxnzavwnql'
const url = process.env.VITE_SUPABASE_URL ?? ''
if (!url.includes(DEV_REF)) throw new Error('ARRÊT : données fictives réservées à la base de dev')
const db = createClient<Database>(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })

const PLAYERS = 8
// Prénoms en lettres : le rapprochement des fiches importées ignore les chiffres (« Joueur 1 » = « Joueur 2 »)
const NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']
const WEEKS = 4 // les 4 dernières semaines jusqu'à aujourd'hui
// Semaine type des joueurs fictifs : jour (0 = lundi) → activités et durées
const DAYS: Record<number, [string, number][]> = {
  0: [['Dév. Tactique', 30], ['Musculation', 60], ['Jeu au Poste', 30]],
  1: [['Musculation', 60], ['Dév. Indiv', 30], ['Collectif Réduit', 40]],
  2: [['Musculation', 60], ['Jeu au Poste', 45], ['Collectif CRABOS', 90]],
  3: [['Récupération', 60]],
  4: [['Jeu au Poste', 30], ['Musculation', 60], ['Collectif CRABOS', 60]],
}

// Pseudo-aléatoire reproductible : mêmes données à chaque exécution
let seed = 42
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))

const must = <T>(r: { data: T; error: { message: string } | null }, what: string): NonNullable<T> => {
  if (r.error || r.data == null) throw new Error(`${what} : ${r.error?.message ?? 'aucune donnée'}`)
  return r.data as NonNullable<T>
}

// 1. Comptes fictifs (recréés à chaque fois)
const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
for (const u of list.users.filter(u => u.email?.startsWith('fictif.'))) await db.auth.admin.deleteUser(u.id)
const group = must(await db.from('groups').select('id').eq('name', 'PER 2026/27').single(), 'groupe')
const types = new Map(must(await db.from('activity_types').select('id, name'), 'activités').map(t => [t.name, t.id]))
const tests = new Map(must(await db.from('test_definitions').select('id, name'), 'tests').map(t => [t.name, t.id]))

const ids: string[] = []
for (let i = 1; i <= PLAYERS; i++) {
  const { data, error } = await db.auth.admin.createUser({ email: `fictif.${i}@joueurs.rnr`, password: generatePassword(), email_confirm: true })
  if (error) throw error
  ids.push(data.user.id)
  must(await db.from('profiles').insert({
    id: data.user.id, role: 'player', first_name: NAMES[i - 1], last_name: 'FICTIF', position: ['Pilier', 'Talon', '2ème Ligne', 'Centre'][i % 4],
  }).select(), 'profil')
}
must(await db.from('group_members').insert(ids.map(player_id => ({ group_id: group.id, player_id }))).select(), 'membres')

// 2. Formes et RPE : chaque joueur a son profil (assidu, fatigué, oublieux…)
const today = parisDate()
const from = addDays(isoWeekStart(today), -7 * (WEEKS - 1))
const logs: Database['public']['Tables']['session_logs']['Insert'][] = []
const wellness: Database['public']['Tables']['wellness_entries']['Insert'][] = []
ids.forEach((player_id, i) => {
  const assiduity = [0.95, 0.9, 0.6, 0.85, 0.95, 0.4, 0.8, 0.9][i]
  const tired = i === 1 || i === 6 // deux joueurs en forme basse
  for (let d = from; d <= today; d = addDays(d, 1)) {
    const day = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7
    if (rand() < assiduity) {
      const base = tired ? 2 : 4
      const item = () => Math.max(1, Math.min(5, base + between(-1, 1)))
      wellness.push({ player_id, entry_date: d, sleep_quality: item(), fatigue: item(), soreness_upper: item(), soreness_lower: item(), stress: item(), mood: item() })
    }
    for (const [name, minutes] of DAYS[day] ?? []) {
      if (d === today || rand() > assiduity) continue // aujourd'hui : laissé aux tests de saisie
      const requiresRpe = name !== 'Récupération'
      logs.push({
        player_id, session_date: d, activity_type_id: types.get(name)!, duration_min: minutes,
        rpe: requiresRpe ? between(tired ? 6 : 3, tired ? 9 : 7) : null, source: 'staff', validated_at: `${d}T20:00:00+02:00`,
      })
    }
  }
})
must(await db.from('wellness_entries').insert(wellness).select('id'), 'formes')
must(await db.from('session_logs').insert(logs).select('id'), 'RPE')

// 3. Programmes de musculation fictifs : 4 exercices par séance, charges en progression, retours liés aux RPE de séance
const PROGRAM: [string, string, number | null, string][] = [ // exercice, unité, charge de départ, reps
  ['Développé Couché', 'kg', 70, '5'], ['Back Squat', 'kg', 90, '5'], ['Front Squat', 'pct_rm', 80, '3'], ['Tirage Banc', 'free', null, '8'],
]
must(await db.from('exercises').upsert(PROGRAM.map(([name]) => ({ name })), { onConflict: 'name' }).select(), 'exercices')
const exerciseIds = new Map(must(await db.from('exercises').select('id, name').in('name', PROGRAM.map(p => p[0])), 'exercices').map(e => [e.name, e.id]))
const muscuLogs = logs.filter(l => l.activity_type_id === types.get('Musculation'))
const sessions = must(await db.from('planned_sessions').insert(muscuLogs.map(l => ({
  session_date: l.session_date!, title: 'Musculation', player_id: l.player_id, activity_type_id: types.get('Musculation')!, planned_duration_min: 60,
}))).select('id, player_id, session_date'), 'séances muscu')
for (const s of sessions) {
  const week = Math.floor((Date.parse(s.session_date) - Date.parse(from)) / (7 * 86400000))
  const planned = must(await db.from('planned_exercises').insert(PROGRAM.map(([name, unit, start, reps], i) => ({
    planned_session_id: s.id, exercise_id: exerciseIds.get(name)!, position: i + 1, block_label: ['A1', 'B1', 'B2', 'C1'][i], sets: 5, reps,
    load_unit: unit, load_value: start === null ? null : unit === 'kg' ? start + 2.5 * week : start,
  }))).select('id, position, load_value, load_unit'), 'exercices planifiés')
  must(await db.from('exercise_feedback').insert(planned.map(e => {
    const status = rand() < 0.85 ? 'fait' : rand() < 0.5 ? 'partiel' : 'non fait'
    const kg = e.load_unit === 'kg' ? Number(e.load_value) + (rand() < 0.75 ? between(0, 1) * 2.5 : -5) : between(30, 60)
    return { player_id: s.player_id!, planned_exercise_id: e.id, status, rpe: status === 'non fait' ? null : between(5, 9),
      done_load: status === 'non fait' ? null : `${between(2, 4)}x${kg}` }
  })).select('id'), 'retours')
  must(await db.from('session_logs').update({ planned_session_id: s.id }).match({ player_id: s.player_id!, session_date: s.session_date, activity_type_id: types.get('Musculation')! }).select(), 'lien')
}

// 4. Un joueur blessé, des tests et des objectifs
must(await db.from('player_availability').insert({ player_id: ids[5], status: 'blessé', note: 'Fictif : entorse cheville' }).select(), 'blessé')
const testRows = ids.slice(0, 4).flatMap(player_id => [
  { player_id, test_id: tests.get('CMJ')!, test_date: from, period: 'P1', value: between(30, 45) },
  { player_id, test_id: tests.get('Sprint 10m')!, test_date: from, period: 'P1', value: 1.7 + between(0, 30) / 100 },
])
must(await db.from('test_results').insert(testRows).select(), 'tests')
must(await db.from('player_targets').insert(ids.slice(0, 4).map(player_id => (
  { player_id, season: '2026-2027', test_id: tests.get('CMJ')!, target_value: 50 }))).select(), 'objectifs')

// 5. Performance : deux matchs passés, GPS pour 6 joueurs sur 8 (8 boîtiers pour le groupe), notes du staff sur le premier
const POSTE = ['PILIER', 'TALON', '2ÈME LIGNE', 'CENTRE']
for (const [k, opponent] of ['R92', 'USON'].entries()) {
  const match_date = addDays(today, -8 + 7 * k) // samedis précédents
  const match = must(await db.from('matches').upsert({ group_id: group.id, match_date, opponent, label: `J${k + 3}` }, { onConflict: 'group_id,match_date,opponent' }).select('id').single(), 'match')
  const withGps = ids.filter((_, i) => i !== 5 && i !== (k ? 2 : 7)) // le blessé n'a pas joué ; un joueur sans boîtier
  must(await db.from('gps_records').insert(withGps.map((player_id, i) => {
    const minutes = [70, 55, 40, 70, 16, 62][i] ?? 70
    return { match_id: match.id, player_id, position: POSTE[(ids.indexOf(player_id) + 1) % 4], minutes,
      distance_m: Math.round(minutes * between(60, 95)), hi_distance_m: between(0, 90), accelerations: between(8, 35), vmax: 24 + between(0, 60) / 10 }
  })).select('id'), 'GPS')
  if (k === 0) must(await db.from('match_ratings').insert(ids.slice(0, 4).map((player_id, i) =>
    ({ match_id: match.id, player_id, rater: 'staff', color: ['vert', 'jaune', 'bleu', 'rouge'][i] }))).select('id'), 'notes staff')
}

console.log(`${PLAYERS} joueurs fictifs, ${wellness.length} formes, ${logs.length} RPE, ${sessions.length} séances muscu du ${from} au ${today}, 1 blessé, ${testRows.length} tests`)

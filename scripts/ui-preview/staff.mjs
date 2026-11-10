// Aperçu visuel des écrans STAFF sans compte ni donnée réelle : session fictive, effectif fictif,
// réponses Supabase simulées, toute autre requête vers Supabase bloquée (rien ne sort du navigateur de test).
// Usage : npx vite --port 5199   puis   node scripts/ui-preview/staff.mjs <dossier> [dark|light] [largeur] [prog]
import { chromium } from 'playwright'

const [out, theme = 'dark', w = '1440', only] = process.argv.slice(2)
if (!out) throw new Error('Usage : node scripts/ui-preview/staff.mjs <dossier de sortie> [dark|light] [largeur] [prog]')
const width = Number(w)
const REF = 'jlfbjuoqbxsxnzavwnql' // projet de dev (adresse publique) : nom de la clé de session dans le navigateur
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
const STAFF = 'mock-staff'

const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const monday = addDays(TODAY, -((new Date(`${TODAY}T00:00:00Z`).getUTCDay() + 6) % 7))
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

const NAMES = [['Hugo', 'MARTIN'], ['Lucas', 'BERNARD'], ['Nathan', 'PETIT'], ['Enzo', 'ROBERT'], ['Louis', 'RICHARD'], ['Jules', 'DURAND'],
  ['Gabriel', 'LEROY'], ['Arthur', 'MOREAU'], ['Raphaël', 'SIMON'], ['Tom', 'LAURENT'], ['Noah', 'LEFEBVRE'], ['Mathis', 'MICHEL'],
  ['Théo', 'GARCIA'], ['Adam', 'DAVID'], ['Sacha', 'BERTRAND'], ['Maël', 'ROUX']]
const POS = ['Pilier', 'Talon', '2ème Ligne', '3ème Ligne', 'Demi de mêlée', 'Ouvreur', 'Centre', 'Ailier', 'Arrière']
const roster = NAMES.map(([first_name, last_name], i) => ({ id: `p${i + 1}`, first_name, last_name, position: POS[i % POS.length], role: 'player' }))
const INJURED = ['p5']

const types = [
  { id: 't-rehab', name: 'Réhabilitation', pillar: 'physique', requires_rpe: true, default_duration_min: 45 },
  { id: 't-sains', name: 'Membres sains', pillar: 'physique', requires_rpe: true, default_duration_min: 45 },
  { id: 't-ct', name: 'Collectif Total', pillar: 'rugby', requires_rpe: true, default_duration_min: 90 },
  { id: 't-jp', name: 'Jeu au Poste', pillar: 'rugby', requires_rpe: true, default_duration_min: 45 },
  { id: 't-dt', name: 'Dév. Tactique', pillar: 'rugby', requires_rpe: true, default_duration_min: 30 },
  { id: 't-mus', name: 'Musculation', pillar: 'physique', requires_rpe: true, default_duration_min: 60 },
  { id: 't-vid', name: 'Vidéo', pillar: 'accompagnement', requires_rpe: false, default_duration_min: 30 },
  { id: 't-rec', name: 'Récupération', pillar: 'accompagnement', requires_rpe: false, default_duration_min: 45 },
]
const weekTypes = [
  { code: 'DEV', name: 'Développement', target_srpe: 3000, srpe_min: 2500, srpe_max: null, volume_min: 600, physique_min: 150, rugby_min: 200, accompagnement_min: 100, ppid_min: 150 },
  { code: 'COMP', name: 'Compétition', target_srpe: 2000, srpe_min: 1500, srpe_max: 2500, volume_min: 480, physique_min: 120, rugby_min: 160, accompagnement_min: 80, ppid_min: 120 },
  { code: 'REG', name: 'Régénération', target_srpe: 1000, srpe_min: 500, srpe_max: 1500, volume_min: 300, physique_min: 60, rugby_min: 120, accompagnement_min: 60, ppid_min: 60 },
]
const weeks = Array.from({ length: 10 }, (_, i) => ({
  code: `S${i + 1}`, label: `Semaine ${i + 1}`, start_date: addDays(monday, (i - 6) * 7),
  week_type_code: ['COMP', 'DEV', 'DEV', 'REG', 'COMP', 'DEV', 'COMP', 'REG', 'COMP', 'DEV'][i], cycle: i < 5 ? 'Cycle 1' : 'Cycle 2', phase_note: null, is_off: false,
}))

// Saison : chaque joueur, chaque jour passé (sauf dimanche), 1 à 3 activités ; état de forme quasi quotidien
const logs = []; const wellness = []
for (let d = weeks[0].start_date; d <= TODAY; d = addDays(d, 1)) {
  const dow = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7
  for (const p of roster) {
    const shape = Number(p.id.slice(1))
    if (dow < 6) for (const a of dow % 2 ? ['t-ct', 't-vid'] : ['t-jp', 't-mus', 't-dt']) {
      if ((INJURED.includes(p.id) && a !== 't-mus') || rnd() < 0.12) continue
      const t = types.find(x => x.id === a)
      const rpe = t.requires_rpe ? Math.min(10, Math.max(2, Math.round(4 + rnd() * 4 + (shape % 4 === 0 ? 1.5 : 0)))) : null
      logs.push({ player_id: p.id, session_date: d, activity_type_id: a, duration_min: t.default_duration_min, rpe, srpe: rpe === null ? 0 : rpe * t.default_duration_min, source: 'app', created_at: `${d}T18:${String(10 + shape).padStart(2, '0')}:00Z` })
    }
    if ((d === TODAY && shape > 11) || rnd() < 0.08) continue // aujourd'hui : 11 joueurs sur 16 ont rempli
    const v = () => Math.min(5, Math.max(1, Math.round(2.6 + rnd() * 2.6 - (shape === 3 ? 1.4 : 0))))
    const it = { sleep_quality: v(), fatigue: v(), soreness: null, soreness_upper: v(), soreness_lower: shape === 7 && d === TODAY ? 1 : v(), stress: v(), mood: v() }
    const score = it.sleep_quality + it.fatigue + it.soreness_upper + it.soreness_lower + it.stress + it.mood
    wellness.push({ player_id: p.id, entry_date: d, ...it, score, source: 'app' })
  }
}

// Planning du groupe (mêmes activités que les déclarations) avec RPE visé 4-6 : RPE non déclarés, hors fourchette, rythme
const groupPlan = []
for (let d = weeks[0].start_date; d <= addDays(monday, 6); d = addDays(d, 1)) {
  const dow = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7
  if (dow < 6) for (const a of dow % 2 ? ['t-ct', 't-vid'] : ['t-jp', 't-mus', 't-dt']) {
    const t = types.find(x => x.id === a)
    groupPlan.push({ player_id: null, session_date: d, activity_type_id: a, planned_duration_min: t.default_duration_min, planned_rpe: t.requires_rpe ? 4 : null,
      planned_rpe_max: t.requires_rpe ? 6 : null, activity_types: { name: t.name, default_duration_min: t.default_duration_min } })
  }
}

const ex = (id, position, block_label, name, sets, reps, load_value, load_unit, fb) =>
  ({ id, position, block_label, sets, reps, load_value, load_unit, tempo: null, rest: "2'", instructions: null, exercises: { name }, exercise_feedback: fb ? [fb] : [] })
const muscu = []
for (const wk of weeks) for (const p of roster.slice(0, 10)) for (const dayOffset of [1, 3]) {
  const d = addDays(wk.start_date, dayOffset), past = d <= TODAY, base = 90 + Number(p.id.slice(1)) * 3 + weeks.indexOf(wk) * 2.5
  const hurt = INJURED.includes(p.id) // blessé : réhab le mardi, membres sains le jeudi, douleur EVA
  const fb = (s, load) => (past && rnd() > 0.15 ? { rpe: 6 + Math.round(rnd() * 3), done_load: s === 'fait' ? load : null, status: s, comment: null, pain: hurt ? Math.max(0, 6 - weeks.indexOf(wk) - Math.round(rnd() * 2)) : null } : null)
  muscu.push({ id: `m-${p.id}-${d}`, session_date: d, player_id: p.id, activity_type_id: hurt ? (dayOffset === 1 ? 't-rehab' : 't-sains') : 't-mus', activity_types: { name: hurt ? (dayOffset === 1 ? 'Réhabilitation' : 'Membres sains') : 'Musculation' }, planned_duration_min: 60, planned_exercises: [
    ex(`${p.id}${d}a`, 1, 'A1', 'Squat arrière', 5, '5', Math.round(base), 'kg', fb(rnd() > 0.2 ? 'fait' : 'partiel', `5x${Math.round(base)}`)),
    ex(`${p.id}${d}b`, 2, 'B1', 'Développé couché', 4, '6', Math.round(base * 0.7), 'kg', fb(rnd() > 0.25 ? 'fait' : 'non fait', `4x${Math.round(base * 0.7)}`)),
    ex(`${p.id}${d}c`, 3, 'C1', 'Gainage latéral', 3, "30''", null, 'bw', fb('fait', null)),
  ] })
}
const def = (name, unit, higher_is_better = true) => ({ name, unit, higher_is_better })
// Tests du groupe (2 dates) et barème FFR fictif, mêmes seuils pour tous les postes : [test, unité, plus haut = mieux, base, bleu, vert, jaune]
const TESTDEFS = [['CMJ', 'cm', true, 38, 45, 40, 35], ['Sprint 10m', 's', false, 1.86, 1.75, 1.82, 1.9], ['Développé Couché 3RM', 'kg', true, 85, null],
  ['Yo-Yo Test', 'm', true, 2100, 2400, 2100, 1800], ['Broad Jump', 'cm', true, 240, 260, 245, 230]]
const REFS = [['CMJ', 45, 40, 35], ['Sprint 10m', 1.75, 1.82, 1.9], ['Yo-Yo Test', 2400, 2100, 1800], ['Broad Jump', 260, 245, 230], ['Développé Couché 1RM', 110, 95, 85]]
const FFR_POS = ['Pilier', 'Talonneur', '2e ligne', '3e ligne', 'Demi de mêlée', "Demi d'ouverture", 'Centre', 'Ailier', 'Arrière']
const tests = roster.flatMap((p, i) => TESTDEFS.flatMap(([name, unit, hib, base]) => ['2026-09-15', '2026-11-03'].map((test_date, k) => {
  const spread = ((i * 7 + name.length * 3) % 11 - 5) / 50 // ±10 % selon le joueur
  const v = base * (1 + (hib ? spread : -spread / 2) + (hib ? k * 0.03 : -k * 0.015))
  return { player_id: p.id, test_id: name, test_date, value: Math.round(v * (unit === 's' ? 100 : 1)) / (unit === 's' ? 100 : 1), test_definitions: def(name, unit, hib), profiles: { is_test: false } }
})))
const targets = [{ test_id: 'Développé Couché 3RM', target_value: 100, label: null, test_definitions: def('Développé Couché 3RM', 'kg') },
  { test_id: 'Sprint 10m', target_value: 1.75, label: null, test_definitions: def('Sprint 10m', 's', false) }]

// Performance : 6 matchs passés, GPS de 20 joueurs, référentiel des postes, notes du coach et des joueurs
import { readdirSync } from 'node:fs'
const LOGOS = readdirSync(new URL('../../public/logos-clubs/', import.meta.url)).slice(0, 6)
const matches = ['R92', 'USON Nevers', 'Stade Français', 'Lyon OU', 'Clermont', 'Toulon'].map((opponent, i) => ({
  id: `g${i}`, match_date: addDays(TODAY, -7 * (6 - i) - 1), opponent, label: `J${i + 1}`, home: i % 2 === 0, logo: LOGOS[i] ?? null }))
const GPOS = [['PILIER', 'Avants', 4970, 10, 15], ['TALONNEUR', 'Avants', 5300, 40, 18], ['2EME LIGNE', 'Avants', 5400, 60, 16], ['3EME LIGNE', 'Avants', 5900, 150, 20],
  ['DEMI DE MELEE', 'Demis', 6100, 220, 24], ['OUVREUR', 'Demis', 6000, 200, 20], ['CENTRE', 'Trois-quarts', 5800, 300, 22], ['AILIER', 'Trois-quarts', 5600, 400, 20], ['ARRIERE', 'Trois-quarts', 6000, 380, 21]]
const gpsRef = GPOS.map(([p, , d, h, a]) => ({ position_group: p, distance_m: d, hi_distance_m: h, accelerations: a, ref_minutes: 70 }))
const gpsPos = GPOS.map(([p]) => ({ position: p, position_group: p }))
const gpsRecs = matches.flatMap((m, mi) => roster.slice(0, 20).map((p, i) => {
  const [pos, , d, h, a] = GPOS[i % GPOS.length]; const minutes = i > 16 ? 12 + Math.round(rnd() * 20) : 45 + Math.round(rnd() * 25); const k = (0.8 + rnd() * 0.45 + mi * 0.01) * minutes / 70
  return { match_id: m.id, player_id: p.id, position: pos, minutes, distance_m: Math.round(d * k), hi_distance_m: Math.round(h * k * (0.7 + rnd() * 0.7)), accelerations: Math.round(a * k), vmax: Math.round((26 + rnd() * 8) * 10) / 10 }
}))
const RC = ['rouge', 'jaune', 'vert', 'bleu']
const ratings = matches.slice(0, 5).flatMap((m, mi) => roster.slice(0, 18).flatMap((p, i) => {
  const out = []
  if (mi < 4 || i < 10) out.push({ match_id: m.id, player_id: p.id, rater: 'staff', color: i === 17 ? 'gris' : RC[Math.floor(rnd() * 4)], comment: i % 5 === 0 ? 'Bon engagement en défense, à confirmer.' : null, minutes: i === 17 ? 0 : 40 + Math.round(rnd() * 30) })
  if (rnd() > 0.35) out.push({ match_id: m.id, player_id: p.id, rater: 'player', color: RC[Math.floor(rnd() * 4)], comment: null, minutes: null })
  return out
}))

// Filtres PostgREST utilisés par l'app : eq / gte / lte / in
function filtered(rows, params) {
  return rows.filter(r => [...params.entries()].every(([k, v]) => {
    if (['select', 'order', 'limit', 'offset'].includes(k) || !(k in r)) return true
    const [op, ...rest] = v.split('.'); const val = rest.join('.')
    if (op === 'eq') return String(r[k]) === val
    if (op === 'gte') return String(r[k]) >= val
    if (op === 'lte') return String(r[k]) <= val
    if (op === 'in') return val.replace(/[()]/g, '').split(',').includes(String(r[k]))
    return true
  }))
}
function table(name, url) {
  const p = url.searchParams
  switch (name) {
    case 'profiles': return p.get('id') ? [{ id: STAFF, role: 'admin', first_name: 'Paul', last_name: 'COACH' }] : roster
    case 'player_availability': return p.get('player_id')
      ? [{ status: INJURED.includes(p.get('player_id').slice(3)) ? 'blessé' : 'apte', since: '2026-10-20', note: null }]
      : INJURED.map(player_id => ({ player_id, status: 'blessé', since: '2026-10-20', note: 'Entorse cheville droite (fictif)' }))
    case 'injuries': return [
      { id: 'inj1', player_id: 'p5', occurred_on: '2026-10-20', ended_on: null, location: 'cheville', tissue: 'ligament', mechanism: 'plaque', onset: 'soudaine', activity: 'match', recurrence: false,
        diagnosis: 'Entorse LLE (fictif)', notes: null, alerts: { wellness_days: 22, alert_days: 3, items_at_1: { fatigue: 2, 'courbatures bas': 1 }, acute: 2400, chronic: 1700 } },
      { id: 'inj0', player_id: 'p2', occurred_on: '2026-09-28', ended_on: '2026-10-09', location: 'cuisse', tissue: 'muscle_tendon', mechanism: 'sans_contact', onset: 'soudaine', activity: 'entrainement', recurrence: false,
        diagnosis: null, notes: null, alerts: { wellness_days: 18, alert_days: 0, acute: 1500, chronic: 1600 } },
    ]
    case 'injury_steps': return ['Soins et protection', 'Réathlétisation en salle', 'Course individuelle', 'Collectif sans contact', 'Entraînement avec contact', 'Retour match']
      .map((title, i) => ({ id: `st${i}`, injury_id: 'inj1', player_id: 'p5', position: i + 1, title, criteria: i === 2 ? 'Course, appuis et changements de direction sans douleur' : null,
        planned_days: [3, 7, 7, 7, 5, 0][i], validated_on: i === 0 ? '2026-10-23' : i === 1 ? '2026-11-02' : null }))
    case 'activity_types': return types
    case 'week_types': return weekTypes
    case 'season_weeks': return weeks
    case 'session_logs': return logs
    case 'wellness_entries': return wellness
    case 'planned_sessions': return p.get('select').includes('planned_rpe') ? groupPlan : p.get('select').includes('planned_exercises') ? muscu : muscu.map(m => ({ player_id: m.player_id, session_date: m.session_date }))
    case 'test_results': return tests
    case 'player_targets': return targets
    case 'groups': return [{ id: 'g1', name: 'Pôle Espoir' }, { id: 'g2', name: 'Crabos' }]
    case 'exercises': return ['Squat arrière', 'Développé couché', 'Gainage latéral', 'Tirage vertical'].map((name, i) => ({ id: `x${i}`, name }))
    case 'test_definitions': return [...TESTDEFS.map(([name, unit, hib]) => ({ id: name, ...def(name, unit, hib) })), { id: 'Développé Couché 1RM', ...def('Développé Couché 1RM', 'kg') }]
    case 'test_reference': return REFS.flatMap(([test_id, blue, green, yellow]) => FFR_POS.map(position_group => ({ test_id, position_group, blue, green, yellow })))
    case 'matches': return matches.slice().reverse()
    case 'gps_records': return gpsRecs
    case 'gps_reference': return gpsRef
    case 'gps_positions': return gpsPos
    case 'match_ratings': return ratings
    default: return []
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width, height: 900 } })
await ctx.addInitScript(([ref, t, id]) => {
  localStorage.setItem('rugby-tracker-theme', t)
  localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
    access_token: 'mock', refresh_token: 'mock', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000,
    user: { id, aud: 'authenticated', role: 'authenticated', email: 'paul.coach@rnr.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  }))
}, [REF, theme, STAFF])
const blocked = []
await ctx.route(/supabase\.co\//, async route => {
  const req = route.request(); const url = new URL(req.url())
  const m = url.pathname.match(/\/rest\/v1\/([a-z_]+)$/)
  if (req.method() !== 'GET' || !m) { blocked.push(`${req.method()} ${url.pathname}`); return route.abort() }
  const all = filtered(table(m[1], url), url.searchParams)
  // Pagination comme Supabase (fetchAll lit par pages de 1000) : paramètres offset / limit ou en-tête Range
  const range = (req.headers()['range'] ?? '').match(/^(\d+)-(\d+)$/)
  const offset = Number(url.searchParams.get('offset') ?? range?.[1] ?? 0)
  const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : range ? Number(range[2]) - Number(range[1]) + 1 : all.length
  const rows = all.slice(offset, offset + limit)
  const one = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
  return route.fulfill({ json: one ? (rows[0] ?? null) : rows })
})

const page = await ctx.newPage()
const heights = {}
const shot = async name => { await page.waitForTimeout(400); await page.screenshot({ path: `${out}/staff-${theme}-${width}-${name}.png`, fullPage: true }) }
const open = async path => { await page.goto(`http://localhost:5199${path}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500) }
if (only === 'perf') {
  const cap = async name => { await page.waitForTimeout(1300); heights[name] = await page.evaluate(() => document.documentElement.scrollHeight); await shot(name) }
  await open('/staff/performance')
  await page.getByRole('tab', { name: 'GPS' }).click(); await cap('perf-gps')
  await page.getByRole('tab', { name: 'Match' }).click(); await cap('perf-saison')
  await page.getByLabel('Afficher').selectOption('notes'); await cap('perf-matchs')
  await page.getByRole('button', { name: /Voir et modifier|Noter/ }).first().click(); await cap('perf-noter')
  await page.getByRole('tab', { name: 'Test' }).click(); await cap('perf-tests')
} else if (only === 'prog') {
  await open('/staff/programmation')
  for (const v of ['semaines', 'planning', 'muscu', 'import']) {
    await page.getByLabel('Afficher').selectOption(v); await page.waitForTimeout(1200)
    heights[`prog-${v}`] = await page.evaluate(() => document.documentElement.scrollHeight); await shot(`prog-${v}`)
  }
} else if (only === 'medical') {
  await open('/staff/medical')
  for (const v of ['suivi', 'plan', 'preparation', 'epidemio']) {
    await page.getByLabel('Afficher').selectOption(v); await page.waitForTimeout(1200)
    heights[`med-${v}`] = await page.evaluate(() => document.documentElement.scrollHeight); await shot(`med-${v}`)
  }
} else for (const [name, path] of [['today', '/staff'], ['semaine', '/staff/semaine'], ['muscu', '/staff/musculation'], ['medical', '/staff/medical'], ['joueur', '/staff/joueur/p3']]) {
  await open(path); heights[name] = await page.evaluate(() => document.documentElement.scrollHeight); await shot(name)
}
console.log({ heights, blocked: [...new Set(blocked)] })
await browser.close()

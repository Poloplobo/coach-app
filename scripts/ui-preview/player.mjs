// Aperçu visuel des écrans JOUEUR (390 × 844) sans compte ni donnée réelle : joueur fictif, réponses Supabase simulées,
// toute autre requête vers Supabase bloquée.
// Usage : npx vite --port 5199   puis   node scripts/ui-preview/player.mjs <dossier> [dark|light] [vide|a-noter|blesse]
// « blesse » : joueur blessé avec un plan de retour (étape 3 sur 6). « a-noter » : dernier match pas encore noté par le joueur. « vide » : état de forme du jour pas encore rempli (onglets verrouillés).
import { readdirSync } from 'node:fs'
import { chromium } from 'playwright'

const [out, theme = 'dark', scenario = 'rempli'] = process.argv.slice(2)
if (!out) throw new Error('Usage : node scripts/ui-preview/player.mjs <dossier de sortie> [dark|light] [vide]')
const REF = 'jlfbjuoqbxsxnzavwnql'
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
const PLAYER = 'mock-player'
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const monday = addDays(TODAY, -((new Date(`${TODAY}T00:00:00Z`).getUTCDay() + 6) % 7))

const types = [
  { id: 't-ct', name: 'Collectif Total', requires_rpe: true, default_duration_min: 90 },
  { id: 't-vid', name: 'Vidéo', requires_rpe: false, default_duration_min: 30 },
  { id: 't-mus', name: 'Musculation', requires_rpe: true, default_duration_min: 60 },
]
const base = { player_id: PLAYER, sleep_quality: 4, fatigue: 3, soreness_upper: 4, soreness_lower: 2, stress: 4, mood: 4, source: 'app' }
const wellness = [-6, -5, -4, -3, -2, -1, 0].map((n, i) => ({ ...base, entry_date: addDays(TODAY, n), score: [24, 22, 19, 15, 20, 23, 21][i] }))
  .filter(w => scenario !== 'vide' || w.entry_date !== TODAY)
const logs = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(monday, i)).filter(d => d < TODAY)
  .map((d, i) => ({ id: `l${i}`, session_date: d, activity_type_id: 't-ct', planned_session_id: null, duration_min: 90, rpe: 5 + (i % 3), srpe: 90 * (5 + (i % 3)), validated_at: null }))
const ex = (id, position, block_label, name, sets, reps, load_value, load_unit, feedback = []) =>
  ({ id, exercise_id: `x-${name}`, position, block_label, sets, reps, load_value, load_unit, tempo: null, rest: "2'", instructions: null, exercises: { name }, exercise_feedback: feedback })
const muscu = { id: 'mock-muscu', session_date: TODAY, planned_duration_min: 60, focus: 'Puissance BDC', activity_types: { name: 'Musculation' }, planned_exercises: [
  ex('e1', 1, 'A1', 'Squat arrière', 5, '5', 80, 'pct_rm', [{ rpe: 7, done_load: '2x125 1x120', status: 'fait', comment: null }]),
  ex('e2', 2, 'A2', 'Box jump', 5, '3', null, 'bw'),
  ex('e3', 3, 'B1', 'Développé couché', 4, '6', 85, 'kg'),
  { ...ex('e4', 4, 'C1', 'Gainage latéral', 3, "30''", null, null), rest: 'récup complète' },
] }

// Performance : 4 matchs passés, GPS sur 3, notes du joueur et du coach sur le dernier (sauf scénario « a-noter »)
const LOGOS = readdirSync(new URL('../../public/logos-clubs/', import.meta.url)).slice(0, 4)
const matches = ['Clermont', 'Lyon OU', 'Stade Français', 'R92'].map((opponent, i) => ({
  id: `g${i}`, match_date: addDays(TODAY, -7 * i - 2), opponent, label: `J${6 - i}`, home: i % 2 === 0, logo: LOGOS[i] ?? null }))
const gps = [[0, 62, 5480, 410, 23, 33.4], [1, 70, 6120, 520, 26, 32.1], [3, 55, 4300, 220, 15, 31.2]].map(([i, minutes, distance_m, hi_distance_m, accelerations, vmax]) =>
  ({ match_id: `g${i}`, player_id: PLAYER, position: 'AILIER', minutes, distance_m, hi_distance_m, accelerations, vmax }))
const ratings = [
  ...(scenario === 'a-noter' ? [] : [{ match_id: 'g0', player_id: PLAYER, rater: 'player', color: 'vert', comment: null, minutes: null },
    { match_id: 'g0', player_id: PLAYER, rater: 'staff', color: 'bleu', comment: 'Très bon placement défensif, continue à attaquer la ligne.', minutes: 62 }]),
  { match_id: 'g1', player_id: PLAYER, rater: 'player', color: 'jaune', comment: null, minutes: null },
  { match_id: 'g1', player_id: PLAYER, rater: 'staff', color: 'vert', comment: null, minutes: 70 },
]
const guidelines = [['rouge', 'Engagement insuffisant'], ['jaune', 'Quelques bonnes actions'], ['vert', 'Rôle tenu'], ['bleu', 'Au-dessus du niveau attendu']]
  .map(([color, guideline]) => ({ color, guideline }))

// Tests : [nom, unité, plus haut = mieux, 1er test, 2e test, exercice lié, objectif, libellé] (jeu équivalent au compte joueur.test)
const TESTS = [
  ['CMJ', 'cm', true, 36, 39, null, 45], ['Sprint 10m', 's', false, 1.95, 1.89, null, 1.8], ['Tractions', 'rép.', true, 8, 11, null, 15],
  ['Développé Couché 3RM', 'kg', true, 80, 87.5, null, 100, '100 kg 3RM'], ['Front Squat 3RM', 'kg', true, 95, 105, 'x-Squat arrière', 120],
  ['Yo-Yo Test', 'm', true, 1960, 2240, null, 2400], ['Développé militaire 3RM', 'kg', true, 55, 60, null, 60],
  ['Sprint 50m', 's', false, 7.1, 6.95], ['Broad Jump', 'cm', true, 238, 245],
]
// Barème FFR fictif (3e ligne) : [test, bleu, vert, jaune] ; médailles du groupe du joueur fictif
const REFS = [['CMJ', 45, 40, 35], ['Sprint 10m', 1.75, 1.82, 1.9], ['Sprint 50m', 6.4, 6.7, 7.0], ['Broad Jump', 260, 245, 230],
  ['Yo-Yo Test', 2400, 2100, 1800], ['Développé Couché 1RM', 110, 95, 85], ['Back Squat 1RM', 160, 140, 120]]
const MEDALS = [{ test_id: 'Yo-Yo Test', medal: 'or' }, { test_id: 'CMJ', medal: 'bronze' }, { test_id: 'Broad Jump', medal: 'argent' }]
// Suivi individuel (étape 14), données fictives : drapeau ouvert seulement dans les scénarios « suivi »
const iso = (days, h) => `${addDays(TODAY, days)}T${String(h).padStart(2, '0')}:00:00+01:00`
const FOLLOW = {
  follow_modules: [{ code: 'nutrition', label: 'Nutrition' }, { code: 'sommeil', label: 'Sommeil' }],
  follow_requests: [
    { id: 'rq1', player_id: PLAYER, module_code: 'nutrition', slots: [iso(2, 17), iso(3, 12)], comment: 'Je veux prendre du poids avant la reprise.', status: 'autre_creneau', confirmed_slot: null, proposed_slot: iso(4, 18), created_at: iso(-1, 9) },
    { id: 'rq2', player_id: 'autre', module_code: 'sommeil', slots: [iso(1, 13), iso(2, 13), iso(5, 17)], comment: null, status: 'en_attente', confirmed_slot: null, proposed_slot: null, created_at: iso(0, 8) },
    { id: 'rq0', player_id: PLAYER, module_code: 'sommeil', slots: [iso(-20, 17)], comment: null, status: 'realise', confirmed_slot: iso(-20, 17), proposed_slot: null, created_at: iso(-24, 9) },
  ],
  follow_request_notes: [{ request_id: 'rq1', notes: 'Petit-déjeuner souvent sauté. À revoir après le match.' }],
  follow_enrollments: [
    { id: 'en1', player_id: PLAYER, module_code: 'sommeil', status: 'actif', activated_at: iso(-20, 18), consented_at: iso(-19, 8), ended_at: null },
    { id: 'en2', player_id: 'autre', module_code: 'nutrition', status: 'actif', activated_at: iso(-3, 18), consented_at: null, ended_at: null },
  ],
  follow_goals: [
    { id: 'go1', enrollment_id: 'en1', player_id: PLAYER, central: 'Mieux récupérer entre les entraînements', means: ['Coucher avant 23 h en semaine', 'Écrans coupés 30 min avant de dormir'], target_label: '8 h par nuit', target_value: 8, baseline: 6.5, unit: 'h', due_on: addDays(TODAY, 40), status: 'en_cours', created_at: iso(-19, 9), validated_at: iso(-19, 12) },
    { id: 'go0', enrollment_id: 'en1', player_id: PLAYER, central: 'Se coucher à heure fixe', means: ['Réveil à la même heure le week-end'], target_label: '5 nuits sur 7', target_value: null, baseline: null, unit: null, due_on: addDays(TODAY, -21), status: 'atteint', created_at: iso(-60, 9), validated_at: iso(-60, 12) },
  ],
}
const followOn = scenario.startsWith('suivi')
const mine = rows => (scenario === 'suivi' ? rows.filter(r => !r.player_id || r.player_id === PLAYER) : rows.filter(r => !r.player_id))

function table(name, url) {
  const p = url.searchParams
  switch (name) {
    case 'profiles': return [{ id: PLAYER, role: 'player', first_name: 'Léo', last_name: 'FICTIF', position: '3ème Ligne' }]
    case 'wellness_entries': return p.get('entry_date')?.startsWith('eq.') ? wellness.filter(w => `eq.${w.entry_date}` === p.get('entry_date')) : wellness
    case 'player_availability': return [{ status: scenario === 'blesse' ? 'blessé' : 'apte' }]
    case 'activity_types': return types
    case 'session_logs': return logs
    case 'planned_sessions': return p.get('select').includes('planned_exercises') ? [muscu] : [
      { id: 'p1', session_date: TODAY, player_id: null, planned_duration_min: null, activity_types: types[0] },
      { id: 'p2', session_date: TODAY, player_id: null, planned_duration_min: 25, activity_types: types[1] },
      { id: 'mock-muscu', session_date: TODAY, player_id: PLAYER, planned_duration_min: 60, activity_types: types[2] },
    ]
    case 'test_results': return TESTS.flatMap(([name, unit, hib, v1, v2, exercise_id]) => [[addDays(TODAY, -56), v1], [addDays(TODAY, -7), v2]]
      .map(([test_date, value]) => ({ test_id: name, test_date, value, test_definitions: { name, unit, higher_is_better: hib, exercise_id } })))
    case 'test_reference': return REFS.map(([test_id, blue, green, yellow]) => ({ test_id, position_group: '3e ligne', blue, green, yellow }))
    case 'test_definitions': return [...new Set([...TESTS.map(t => t[0]), ...REFS.map(x => x[0])])].map(n => ({ id: n, name: n }))
    case 'player_targets': return TESTS.filter(t => t[6] != null).map(([name, unit, hib, , , , target_value, label]) =>
      ({ test_id: name, target_value, label: label ?? null, test_definitions: { name, unit, higher_is_better: hib } }))
    case 'exercise_feedback': return [['Squat arrière', '2x120 1x115', -5], ['Développé couché', '4x80', -5], ['Développé couché', '4x77,5', -12]]
      .map(([n, done_load, d]) => ({ done_load, planned_exercises: { exercise_id: `x-${n}`, planned_sessions: { session_date: addDays(TODAY, d) } } }))
    case 'season_weeks': return [{ code: 'S9', week_types: { code: 'COMP', name: 'Compétition', srpe_min: 1500, srpe_max: 2500, target_srpe: 2000 } }]
    case 'matches': return matches
    case 'gps_records': return gps
    case 'gps_reference': return [{ position_group: 'AILIER', distance_m: 5600, hi_distance_m: 400, accelerations: 20, ref_minutes: 70 }]
    case 'gps_positions': return [{ position: 'AILIER', position_group: 'AILIER' }]
    case 'match_ratings': return ratings
    case 'rating_guidelines': return guidelines
    default: return followOn && FOLLOW[name] ? mine(FOLLOW[name]) : []
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(([ref, t, id]) => {
  localStorage.setItem('rugby-tracker-theme', t)
  localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
    access_token: 'mock', refresh_token: 'mock', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000,
    user: { id, aud: 'authenticated', role: 'authenticated', email: 'leo.fictif@joueurs.rnr', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  }))
}, [REF, theme, PLAYER])
// Plan de retour fictif (rpc my_return_plan : jamais d'actions kiné ni de commentaire côté joueur)
const occurred = addDays(TODAY, -17)
const plan = [
  ['Soins et protection', 3, -14, 'Phase 1 : protéger', 'Diminuer la douleur et l\'œdème', 'Gainage, haut du corps assis'],
  ['Réathlétisation en salle', 7, -4, 'Phase 2 : reconstruire', 'Retrouver force et proprioception', 'Mollets, squats, équilibre unipodal'],
  ['Course individuelle', 7, null, 'Phase 2 : reconstruire', 'Courir sans douleur, appuis et changements de direction', 'Course en ligne puis appuis, 20 min'],
  ['Collectif sans contact', 7, null, 'Phase 3 : revenir', 'Réintégrer le groupe sans contact', 'Séances collectives sans contact'],
  ['Entraînement avec contact', 5, null, 'Phase 3 : revenir', 'Contact progressif', null],
  ['Retour match', 0, null, 'Phase 3 : revenir', null, null],
].map(([title, planned_days, v, phase, objectives, prepa_actions], i) => ({ occurred_on: occurred, id: `st${i}`, step: i + 1, title, planned_days,
  validated_on: v === null ? null : addDays(TODAY, v), criteria: i === 2 ? 'Course, appuis et changements de direction sans douleur' : null,
  phase, phase_days: null, objectives, prepa_actions, is_test: i === 4, in_progress: false }))
// Photo fictive des bancs d'essai : une silhouette dessinée, jamais une vraie photo de joueur
const SILHOUETTE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><g fill="#9aa4b2"><circle cx="300" cy="170" r="85"/><path d="M140 600c0-150 70-250 160-250s160 100 160 250z"/></g></svg>'
const photoRoute = (route, url, req, ids) => {
  if (url.pathname.endsWith('/object/list/player-photos')) return route.fulfill({ json: ids.map(id => ({ name: `${id}.png` })) })
  if (url.pathname.endsWith('/object/sign/player-photos')) {
    const { paths } = JSON.parse(req.postData() ?? '{}')
    return route.fulfill({ json: paths.map(p => ({ path: p, signedURL: `/object/sign/player-photos/${p}?token=mock`, error: null })) })
  }
  if (url.pathname.includes('/object/sign/player-photos/')) return route.fulfill({ contentType: 'image/svg+xml', body: SILHOUETTE })
  return null
}
const blocked = []
await ctx.route(/supabase\.co\//, async route => {
  const req = route.request(); const url = new URL(req.url())
  const photo = photoRoute(route, url, req, [PLAYER]) // un joueur sur quatre sans photo : initiales
  if (photo) return photo
  const m = url.pathname.match(/\/rest\/v1\/([a-z_]+)$/)
  if (url.pathname.endsWith('/rpc/has_feature')) return route.fulfill({ json: followOn })
  if (url.pathname.endsWith('/rpc/my_test_medals')) return route.fulfill({ json: MEDALS })
  if (url.pathname.endsWith('/rpc/my_return_plan')) return route.fulfill({ json: scenario === 'blesse' ? plan : [] })
  if (req.method() !== 'GET' || !m) { blocked.push(`${req.method()} ${url.pathname}`); return route.abort() }
  const rows = table(m[1], url)
  return route.fulfill({ json: (req.headers()['accept'] ?? '').includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows })
})
const page = await ctx.newPage()
const pages = scenario === 'vide' || followOn ? ['forme'] : scenario === 'blesse' ? ['accueil'] : ['accueil', 'seance', 'rugby', 'performance', 'performance-tests', 'forme', 'reglages']
for (const p of pages) {
  await page.goto(`http://localhost:5199${p === 'accueil' ? '/joueur' : `/joueur/${p.replace('-tests', '')}`}`)
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500)
  if (p === 'performance-tests') { await page.getByRole('tab', { name: /tests/i }).click(); await page.waitForTimeout(600) } // volet TESTS
  // fenêtre à la hauteur de la page : la barre d'onglets (fixe) reste en bas au lieu de couvrir le milieu de la capture
  await page.setViewportSize({ width: 390, height: Math.max(844, await page.evaluate(() => document.documentElement.scrollHeight)) })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/player-${theme}-${scenario}-${p}.png` })
  await page.setViewportSize({ width: 390, height: 844 })
}
console.log({ pages, blocked: [...new Set(blocked)] })
await browser.close()

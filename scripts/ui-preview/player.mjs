// Aperçu visuel des écrans JOUEUR (390 × 844) sans compte ni donnée réelle : joueur fictif, réponses Supabase simulées,
// toute autre requête vers Supabase bloquée.
// Usage : npx vite --port 5199   puis   node scripts/ui-preview/player.mjs <dossier> [dark|light] [vide]
// « vide » : état de forme du jour pas encore rempli (onglets verrouillés).
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
  ({ id, position, block_label, sets, reps, load_value, load_unit, tempo: null, rest: "2'", instructions: null, exercises: { name }, exercise_feedback: feedback })
const muscu = { id: 'mock-muscu', session_date: TODAY, planned_duration_min: 60, activity_types: { name: 'Musculation' }, planned_exercises: [
  ex('e1', 1, 'A1', 'Squat arrière', 5, '5', 80, 'pct_rm', [{ rpe: 7, done_load: '2x125 1x120', status: 'fait', comment: null }]),
  ex('e2', 2, 'A2', 'Box jump', 5, '3', null, 'bw'),
  ex('e3', 3, 'B1', 'Développé couché', 4, '6', 85, 'kg'),
] }

function table(name, url) {
  const p = url.searchParams
  switch (name) {
    case 'profiles': return [{ id: PLAYER, role: 'player', first_name: 'Léo', last_name: 'FICTIF' }]
    case 'wellness_entries': return p.get('entry_date')?.startsWith('eq.') ? wellness.filter(w => `eq.${w.entry_date}` === p.get('entry_date')) : wellness
    case 'player_availability': return [{ status: 'apte' }]
    case 'activity_types': return types
    case 'session_logs': return logs
    case 'planned_sessions': return p.get('select').includes('planned_exercises') ? [muscu] : [
      { id: 'p1', session_date: TODAY, player_id: null, planned_duration_min: null, activity_types: types[0] },
      { id: 'p2', session_date: TODAY, player_id: null, planned_duration_min: 25, activity_types: types[1] },
      { id: 'mock-muscu', session_date: TODAY, player_id: PLAYER, planned_duration_min: 60, activity_types: types[2] },
    ]
    default: return []
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
const blocked = []
await ctx.route(/supabase\.co\//, async route => {
  const req = route.request(); const url = new URL(req.url())
  const m = url.pathname.match(/\/rest\/v1\/([a-z_]+)$/)
  if (req.method() !== 'GET' || !m) { blocked.push(`${req.method()} ${url.pathname}`); return route.abort() }
  const rows = table(m[1], url)
  return route.fulfill({ json: (req.headers()['accept'] ?? '').includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows })
})
const page = await ctx.newPage()
const pages = scenario === 'vide' ? ['forme'] : ['accueil', 'seance', 'rugby', 'performance', 'forme', 'reglages']
for (const p of pages) {
  await page.goto(`http://localhost:5199${p === 'accueil' ? '/joueur' : `/joueur/${p}`}`)
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}/player-${theme}-${scenario}-${p}.png` })
}
console.log({ pages, blocked: [...new Set(blocked)] })
await browser.close()

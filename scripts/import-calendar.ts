// Calendrier des matchs de la saison → table matches (groupe PER), avec logos des clubs adverses.
// Source : data/calendrier*.xlsx|csv (Date | Adversaire | Domicile/Extérieur | Journée) et data/logos-clubs/<club>.png.
// Logos copiés dans public/logos-clubs/ (logos publics des clubs, aucune donnée de joueur).
// Usage : npm run calendar:prod (simulation) · npm run calendar:prod -- --confirm=<ref projet> (écriture)
import { createClient } from '@supabase/supabase-js'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import XLSX from 'xlsx'
import { logoSlug, parseCalendar } from './import/parseCalendar'

const url = process.env.VITE_SUPABASE_URL ?? ''
const ref = new URL(url).hostname.split('.')[0]
const confirm = process.argv.find(a => a.startsWith('--confirm='))?.split('=')[1]
if (confirm && confirm !== ref) throw new Error(`ARRÊT : --confirm=${confirm} ne correspond pas au projet ${ref}`)
const db = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })

const file = readdirSync('data').find(f => /^calendrier.*\.(xlsx|csv)$/i.test(f))
if (!file) throw new Error('Fichier data/calendrier….xlsx (ou .csv) introuvable')
const wb = XLSX.read(readFileSync(`data/${file}`), { cellDates: false })
const { matches, errors } = parseCalendar(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true }))
if (errors.length) { console.log(errors.join('\n')); process.exit(1) }

// Logo : fichier de data/logos-clubs dont le nom (sans accents ni casse) correspond à l'adversaire
const logos = existsSync('data/logos-clubs') ? readdirSync('data/logos-clubs').filter(f => /\.(png|jpe?g|webp|svg)$/i.test(f)) : []
const logoOf = (opponent: string) => {
  const s = logoSlug(opponent)
  return logos.find(f => logoSlug(f.replace(/\.\w+$/, '')) === s) ?? logos.find(f => { const l = logoSlug(f.replace(/\.\w+$/, '')); return l.includes(s) || s.includes(l) })
}
const group = (await db.from('groups').select('id').eq('name', 'PER 2026/27').single()).data
if (!group) throw new Error('groupe « PER 2026/27 » introuvable')

for (const m of matches) {
  const logo = logoOf(m.opponent)
  const published = logo ? `${logoSlug(m.opponent)}.${logo.split('.').pop()!.toLowerCase().replace('jpeg', 'jpg')}` : null
  console.log(`${confirm ? 'importé ' : 'à importer'} ${m.date} ${m.label ?? ''} ${m.opponent} ${m.home === null ? '' : m.home ? '(dom.)' : '(ext.)'} logo : ${logo ?? '—'}`)
  if (!confirm) continue
  if (logo && published) { mkdirSync('public/logos-clubs', { recursive: true }); copyFileSync(`data/logos-clubs/${logo}`, `public/logos-clubs/${published}`) }
  const { error } = await db.from('matches').upsert({ group_id: group.id, match_date: m.date, opponent: m.opponent, label: m.label, home: m.home, logo: published },
    { onConflict: 'group_id,match_date,opponent' })
  if (error) throw new Error(`${m.date} ${m.opponent} : ${error.message}`)
}
console.log(`\n${matches.length} matchs${confirm ? ' importés' : ` — simulation. Pour écrire : -- --confirm=${ref}`}`)

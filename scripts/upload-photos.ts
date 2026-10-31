// Photos des joueurs (mineurs) → stockage privé « player-photos » (staff seulement), une par joueur : « <id>.png ».
// Source : data/photos-joueurs/« Prénom NOM_Photo.png » (jamais dans public/). Recadrées au carré (centre) et réduites
// à 400 px avec sips (macOS). Mac de l'admin uniquement : clé secrète.
// Usage : npm run photos:prod                          (simulation : joueurs reconnus, rien n'est envoyé)
//         npm run photos:prod -- --confirm=<ref projet> (envoi)
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nameKey } from '../src/lib/names'

const DIR = 'data/photos-joueurs'
const url = process.env.VITE_SUPABASE_URL ?? ''
const ref = new URL(url).hostname.split('.')[0]
const confirm = process.argv.find(a => a.startsWith('--confirm='))?.split('=')[1]
if (confirm && confirm !== ref) throw new Error(`ARRÊT : --confirm=${confirm} ne correspond pas au projet ${ref}`)
const db = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })

const { data: players, error } = await db.from('profiles').select('id, first_name, last_name, import_name').eq('role', 'player')
if (error) throw error
const tmp = mkdtempSync(join(tmpdir(), 'photos-'))
try {
  for (const file of readdirSync(DIR).filter(f => /\.(png|jpe?g)$/i.test(f))) {
    const name = file.replace(/_Photo\.\w+$/i, '').replace(/\.\w+$/, '')
    const match = players.filter(p => [p.import_name ?? '', `${p.first_name} ${p.last_name}`].some(n => n && nameKey(n) === nameKey(name)))
    if (match.length !== 1) { console.log(`IGNORÉE    ${file} : ${match.length ? 'plusieurs joueurs' : 'joueur introuvable'}`); continue }
    const p = match[0]
    if (!confirm) { console.log(`à envoyer  ${file} → ${p.last_name} ${p.first_name}`); continue }
    // Carré centré puis 400 px : le PowerPoint l'affiche en rond, sans déformation
    const out = join(tmp, `${p.id}.png`)
    copyFileSync(join(DIR, file), out)
    const dims = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', out]).toString().match(/\d+/g)!.slice(-2).map(Number)
    const side = Math.min(...dims)
    execFileSync('sips', ['-s', 'format', 'png', '-c', String(side), String(side), out])
    execFileSync('sips', ['-Z', '400', out])
    const { error: e } = await db.storage.from('player-photos').upload(`${p.id}.png`, readFileSync(out), { contentType: 'image/png', upsert: true })
    if (e) throw new Error(`${file} : ${e.message}`)
    console.log(`envoyée    ${file} → ${p.last_name} ${p.first_name}`)
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
if (!confirm) console.log(`\nSimulation. Pour envoyer : -- --confirm=${ref}`)

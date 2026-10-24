// Crée les comptes listés dans data/import/joueurs.csv (joueurs) et data/import/staff.csv (staff, facultatif).
// Usage : npm run accounts -- [--dry-run]
// Utilise la clé secrète Supabase : ce script tourne uniquement sur le Mac de l'admin, jamais dans l'app.
// Relançable : un compte qui existe déjà est ignoré (son mot de passe n'est pas changé).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loginEmail } from '../src/lib/login'
import { generatePassword, parsePlayersCsv, parseStaffCsv } from './players'

const dryRun = process.argv.includes('--dry-run')
const url = process.env.VITE_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
if (!url || !secretKey) throw new Error('Ajoute VITE_SUPABASE_URL et SUPABASE_SECRET_KEY dans .env.local')

const supabase = createClient(url, secretKey, { auth: { persistSession: false } })
const accounts = [
  ...parsePlayersCsv(readFileSync('data/import/joueurs.csv', 'utf8')).map(p => ({
    login: p.loginId, email: loginEmail(p.loginId), lastName: p.lastName, firstName: p.firstName,
    profile: { role: 'player' as const, first_name: p.firstName, last_name: p.lastName, import_name: p.importName },
  })),
  ...(existsSync('data/import/staff.csv') ? parseStaffCsv(readFileSync('data/import/staff.csv', 'utf8')) : []).map(s => ({
    login: s.email, email: s.email, lastName: s.lastName, firstName: s.firstName,
    profile: { role: s.role, first_name: s.firstName, last_name: s.lastName },
  })),
]

// shortcut: une seule page de 1000 comptes, largement assez pour un effectif ; paginer au-delà
const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
if (listError) throw listError
const existing = new Set(list.users.map(u => u.email))

const created: string[] = []
for (const a of accounts) {
  if (existing.has(a.email)) { console.log(`déjà créé  ${a.login}`); continue }
  if (dryRun) { console.log(`à créer    ${a.login}  (${a.profile.role})`); continue }

  const password = generatePassword()
  const { data, error } = await supabase.auth.admin.createUser({ email: a.email, password, email_confirm: true })
  if (error) throw new Error(`${a.login} : ${error.message}`)

  const { error: profileError } = await supabase.from('profiles').insert({ id: data.user.id, ...a.profile })
  if (profileError) {
    await supabase.auth.admin.deleteUser(data.user.id) // pas de compte sans profil
    throw new Error(`${a.login} : ${profileError.message}`)
  }
  created.push(`${a.lastName};${a.firstName};${a.login};${password}`)
  console.log(`créé       ${a.login}  (${a.profile.role})`)
}

if (created.length) {
  // Un fichier par exécution : on n'écrase jamais des mots de passe pas encore distribués
  const file = `data/import/identifiants-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`
  writeFileSync(file, `NOM;Prénom;Identifiant;Mot de passe\n${created.join('\n')}\n`)
  console.log(`\n${created.length} compte(s) créé(s). Identifiants à distribuer : ${file}`)
} else {
  console.log(dryRun ? '\nSimulation : rien n\'a été écrit.' : '\nAucun nouveau compte.')
}

// Crée le joueur de test « joueur.test » (profil is_test, membre du groupe) : il vérifie l'interface joueur à chaque
// déploiement sans apparaître dans l'effectif. Usage : npm run test-player:prod. Relançable : rien n'est refait s'il existe.
// Utilise la clé secrète Supabase : ce script tourne uniquement sur le Mac de l'admin. Mot de passe écrit dans data/import.
import { writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loginEmail } from '../src/lib/login'
import { generatePassword } from './players'

const url = process.env.VITE_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
if (!url || !secretKey) throw new Error('VITE_SUPABASE_URL et SUPABASE_SECRET_KEY manquants')
const db = createClient(url, secretKey, { auth: { persistSession: false } })
const login = 'joueur.test'
const email = loginEmail(login)

const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 })
if (listError) throw listError
if (list.users.some(u => u.email === email)) {
  console.log(`${login} existe déjà : rien à faire (mot de passe oublié : npm run reset-password:prod -- ${login}).`)
  process.exit(0)
}
const { data: group, error: groupError } = await db.from('groups').select('id, name').order('name').limit(1).single()
if (groupError) throw groupError
const password = generatePassword()
const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
if (error) throw error
const { error: profileError } = await db.from('profiles').insert({ id: data.user.id, role: 'player', first_name: 'Joueur', last_name: 'TEST', is_test: true })
if (profileError) { await db.auth.admin.deleteUser(data.user.id); throw profileError } // pas de compte sans profil
const { error: memberError } = await db.from('group_members').insert({ group_id: group.id, player_id: data.user.id })
if (memberError) throw memberError
const file = 'data/import/IDENTIFIANT-joueur-test.csv'
writeFileSync(file, `Identifiant;Mot de passe\n${login};${password}\n`, { mode: 0o600 }) // lisible par toi seul
console.log(`${login} créé (groupe ${group.name}), hors effectif. Identifiant et mot de passe : ${file}`)

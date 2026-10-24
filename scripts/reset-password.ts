// Mot de passe oublié : génère un nouveau mot de passe provisoire pour un compte.
// Usage : npm run reset-password:prod -- prenom.nom   (ou l'adresse e-mail d'un membre du staff)
// Clé secrète : Mac de l'admin uniquement. Le mot de passe s'affiche une seule fois et n'est écrit nulle part.
import { createClient } from '@supabase/supabase-js'
import { toAuthEmail } from '../src/lib/login'
import { generatePassword } from './players'

const login = process.argv[2]
if (!login) throw new Error('Indique l\'identifiant : npm run reset-password:prod -- prenom.nom')
const url = process.env.VITE_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
if (!url || !secretKey) throw new Error('Ajoute VITE_SUPABASE_URL et SUPABASE_SECRET_KEY dans le fichier .env')

const supabase = createClient(url, secretKey, { auth: { persistSession: false } })
const email = toAuthEmail(login)
// shortcut: une seule page de 1000 comptes, largement assez pour un effectif ; paginer au-delà
const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
if (listError) throw listError
const user = list.users.find(u => u.email === email)
if (!user) throw new Error(`Aucun compte « ${login} » sur ${new URL(url).hostname}`)

const password = generatePassword()
const { error } = await supabase.auth.admin.updateUserById(user.id, { password })
if (error) throw error
console.log(`Nouveau mot de passe provisoire pour ${login} : ${password}`)
console.log('À transmettre en message privé ; le joueur le change ensuite dans Réglages.')

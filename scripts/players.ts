import { randomInt } from 'node:crypto'
import { loginId } from '../src/lib/login'

export type Player = { lastName: string; firstName: string; importName: string; loginId: string }

// data/import/joueurs.csv : une ligne « NOM;Prénom » par joueur (en-tête facultatif)
export function parsePlayersCsv(text: string): Player[] {
  const errors: string[] = []
  const players: Player[] = []
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || (i === 0 && /^nom[;,]/i.test(line))) return
    const [lastName = '', firstName = ''] = line.split(/[;,]/).map(s => s.trim())
    if (!lastName || !firstName) return void errors.push(`ligne ${i + 1} : « ${line} » (attendu NOM;Prénom)`)
    players.push({ lastName, firstName, importName: `${lastName} ${firstName}`, loginId: loginId(firstName, lastName) })
  })
  const seen = new Set<string>()
  for (const p of players) {
    if (seen.has(p.loginId)) errors.push(`identifiant en double : ${p.loginId} (ajoute une initiale à l'un des deux)`)
    seen.add(p.loginId)
  }
  if (errors.length) throw new Error(`joueurs.csv invalide :\n${errors.join('\n')}`)
  return players
}

export type Staff = { email: string; role: 'coach' | 'admin'; firstName: string; lastName: string }

// data/import/staff.csv : une ligne « e-mail;rôle;Prénom;NOM » (rôle : coach ou admin, en-tête facultatif)
export function parseStaffCsv(text: string): Staff[] {
  const errors: string[] = []
  const staff: Staff[] = []
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || (i === 0 && /^e-?mail[;,]/i.test(line))) return
    const [email = '', role = '', firstName = '', lastName = ''] = line.split(/[;,]/).map(s => s.trim())
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || (role !== 'coach' && role !== 'admin') || !firstName || !lastName) {
      return void errors.push(`ligne ${i + 1} : « ${line} » (attendu e-mail;coach ou admin;Prénom;NOM)`)
    }
    staff.push({ email: email.toLowerCase(), role, firstName, lastName })
  })
  if (errors.length) throw new Error(`staff.csv invalide :\n${errors.join('\n')}`)
  return staff
}

// Sans caractères ambigus (0/O, 1/l/I) : il sera recopié à la main par le joueur
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const generatePassword = (length = 12) =>
  Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

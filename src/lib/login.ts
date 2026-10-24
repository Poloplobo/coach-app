// Les joueurs se connectent avec « prenom.nom » ; Supabase Auth exige un e-mail, on en fabrique un interne.
const LOGIN_DOMAIN = 'joueurs.rnr'

export function loginId(firstName: string, lastName: string): string {
  return `${firstName.trim()}.${lastName.trim()}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents
    .toLowerCase()
    .replace(/[^a-z.]+/g, '-')                         // espaces, apostrophes
    .replace(/-?\.-?/g, '.').replace(/^-|-$/g, '')
}

export const loginEmail = (id: string) => `${id.trim().toLowerCase()}@${LOGIN_DOMAIN}`

// Les joueurs tapent « prenom.nom », le staff son adresse e-mail
export const toAuthEmail = (identifier: string) =>
  identifier.includes('@') ? identifier.trim().toLowerCase() : loginEmail(identifier)

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

// Les joueurs tapent « prenom.nom », le staff son adresse e-mail.
// Même normalisation qu'à la création du compte (loginId) : « Élodie.Dupré », « victor adam » ou « victor. adam »
// (espace ajoutée par le clavier du téléphone) retrouvent le compte. Prénom = avant le 1er point, sinon avant la 1re espace.
export function toAuthEmail(identifier: string) {
  const t = identifier.trim()
  if (t.includes('@')) return t.toLowerCase()
  const cut = t.includes('.') ? t.indexOf('.') : t.search(/\s/)
  return loginEmail(cut < 0 ? t : loginId(t.slice(0, cut), t.slice(cut + 1)))
}

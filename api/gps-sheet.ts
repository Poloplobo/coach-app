// Lecture de la feuille Google GPS pour l'import (staff seulement) : l'app ne voit jamais la clé de la feuille.
// Le contrôle des lignes (noms, postes, valeurs) reste celui de l'import de fichier, dans le navigateur, avant « Importer ».
export async function GET(request: Request) {
  const { GPS_SHEET_URL, GPS_SHEET_KEY, VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anon } = process.env
  if (!GPS_SHEET_URL || !GPS_SHEET_KEY || !url || !anon) return new Response('non configuré', { status: 503 })
  const auth = request.headers.get('authorization') ?? ''
  if (!/^Bearer [\w.-]+$/.test(auth)) return new Response('connexion requise', { status: 401 })
  // Le jeton de l'utilisateur, vérifié par Supabase : seul un compte staff reçoit les données GPS
  const staff = await fetch(`${url}/rest/v1/rpc/is_staff`, { method: 'POST', headers: { apikey: anon, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}' })
  if (!staff.ok || (await staff.json().catch(() => false)) !== true) return new Response('réservé au staff', { status: 403 })
  const sheet = await fetch(`${GPS_SHEET_URL}?cle=${encodeURIComponent(GPS_SHEET_KEY)}`).catch(() => null)
  const body = sheet?.ok ? await sheet.json().catch(() => null) as { lignes?: unknown } | null : null
  if (!body || !Array.isArray(body.lignes)) return new Response('feuille GPS illisible', { status: 502 })
  return Response.json({ lignes: body.lignes }, { headers: { 'Cache-Control': 'no-store' } })
}

// Envoi du rappel du matin (0026) : appelé par la base à 8h et 10h avec la liste des abonnements et un secret partagé.
// Aucun accès à la base ici ; message sans donnée personnelle (visible sur l'écran verrouillé).
import { timingSafeEqual } from 'node:crypto'
import webpush from 'web-push'

const MESSAGES = {
  morning: 'Pense à remplir ton état de forme du jour.',
  late: 'Ton état de forme du jour n\'est pas encore rempli.',
} as const
// Mêmes services que la contrainte de push_subscriptions : jamais d'appel vers une autre adresse
const PUSH_HOST = /^https:\/\/(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)\//

type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } }

export function authorized(header: string | null, secret: string) {
  const a = Buffer.from(header ?? ''), b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function readBody(body: unknown): { kind: keyof typeof MESSAGES; subscriptions: Subscription[] } | null {
  if (!body || typeof body !== 'object') return null
  const { kind, subscriptions } = body as { kind?: unknown; subscriptions?: unknown }
  if ((kind !== 'morning' && kind !== 'late') || !Array.isArray(subscriptions) || subscriptions.length > 500) return null
  const ok = subscriptions.every(s => typeof s?.endpoint === 'string' && PUSH_HOST.test(s.endpoint)
    && typeof s.keys?.p256dh === 'string' && typeof s.keys?.auth === 'string')
  return ok ? { kind, subscriptions } : null
}

export async function POST(request: Request) {
  const { PUSH_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (!PUSH_SECRET || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return new Response('non configuré', { status: 503 })
  if (!authorized(request.headers.get('authorization'), PUSH_SECRET)) return new Response('refusé', { status: 401 })
  const body = readBody(await request.json().catch(() => null))
  if (!body) return new Response('requête invalide', { status: 400 })

  webpush.setVapidDetails('https://rugby-tracker-rnr.vercel.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  const payload = JSON.stringify({ title: 'Pôle Espoir', body: MESSAGES[body.kind], url: '/joueur/forme' })
  const results = await Promise.allSettled(body.subscriptions.map(s => webpush.sendNotification(s, payload, { TTL: 2 * 3600, urgency: 'high' })))
  // Abonnement expiré ou retiré : la base le supprime au prochain envoi
  const gone = results.flatMap((r, i) => r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0) ? [body.subscriptions[i].endpoint] : [])
  return Response.json({ sent: results.filter(r => r.status === 'fulfilled').length, failed: results.length - gone.length - results.filter(r => r.status === 'fulfilled').length, gone })
}

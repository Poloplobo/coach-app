import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './gps-sheet'

const call = (auth?: string) => GET(new Request('http://x/api/gps-sheet', { headers: auth ? { authorization: auth } : {} }))
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('api/gps-sheet', () => {
  it('non configuré : 503 ; sans jeton : 401', async () => {
    expect((await call('Bearer a.b.c')).status).toBe(503)
    vi.stubEnv('GPS_SHEET_URL', 'https://script.google.com/x'); vi.stubEnv('GPS_SHEET_KEY', 'k')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://s.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    expect((await call()).status).toBe(401)
  })
  it('compte non staff : 403, la feuille n\'est jamais appelée', async () => {
    vi.stubEnv('GPS_SHEET_URL', 'https://script.google.com/x'); vi.stubEnv('GPS_SHEET_KEY', 'k')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://s.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    const fetch = vi.fn(async () => Response.json(false))
    vi.stubGlobal('fetch', fetch)
    expect((await call('Bearer a.b.c')).status).toBe(403)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('staff : lignes de la feuille relayées', async () => {
    vi.stubEnv('GPS_SHEET_URL', 'https://script.google.com/x'); vi.stubEnv('GPS_SHEET_KEY', 'k')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://s.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    vi.stubGlobal('fetch', vi.fn(async (u: string) => u.includes('is_staff') ? Response.json(true) : Response.json({ lignes: [['Match']] })))
    const r = await call('Bearer a.b.c')
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ lignes: [['Match']] })
  })
})

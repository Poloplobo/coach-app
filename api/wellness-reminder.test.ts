import { describe, expect, it } from 'vitest'
import { authorized, readBody } from './wellness-reminder'

const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: 'x'.repeat(40), auth: 'y'.repeat(16) } })

describe('api/wellness-reminder', () => {
  it('secret exact obligatoire', () => {
    expect(authorized('Bearer abc', 'abc')).toBe(true)
    expect(authorized('Bearer abd', 'abc')).toBe(false)
    expect(authorized(null, 'abc')).toBe(false)
  })
  it('accepte seulement les services de notification connus et un type de message prévu', () => {
    expect(readBody({ kind: 'morning', subscriptions: [sub('https://fcm.googleapis.com/fcm/send/abc'), sub('https://web.push.apple.com/QX')] })).not.toBeNull()
    // adresse hors liste ou en http : écartée, les autres partent quand même
    expect(readBody({ kind: 'morning', subscriptions: [sub('https://exemple.fr/x'), sub('http://fcm.googleapis.com/x'), sub('https://fcm.googleapis.com/ok')] })?.subscriptions
      .map(s => s.endpoint)).toEqual(['https://fcm.googleapis.com/ok'])
    expect(readBody({ kind: 'autre', subscriptions: [] })).toBeNull()
    expect(readBody(null)).toBeNull()
  })
})

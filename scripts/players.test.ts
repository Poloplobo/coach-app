import { describe, expect, it } from 'vitest'
import { generatePassword, parsePlayersCsv, parseStaffCsv } from './players'
import { loginEmail } from '../src/lib/login'

describe('parsePlayersCsv', () => {
  it('lit NOM;Prénom, ignore en-tête et lignes vides', () => {
    const players = parsePlayersCsv('NOM;Prénom\nDUPONT;Jean\n\nDE LA TOUR;Jean-Baptiste\r\nD\'ARTOIS;Élie\n')
    expect(players.map(p => p.loginId)).toEqual(['jean.dupont', 'jean-baptiste.de-la-tour', 'elie.d-artois'])
    expect(players[0].importName).toBe('DUPONT Jean')
  })

  it('refuse une ligne incomplète et les identifiants en double', () => {
    expect(() => parsePlayersCsv('DUPONT')).toThrow(/ligne 1/)
    expect(() => parsePlayersCsv('DUPONT;Jean\nDupont;Jean')).toThrow(/jean.dupont/)
  })
})

describe('parseStaffCsv', () => {
  it('lit e-mail;rôle;Prénom;NOM', () => {
    expect(parseStaffCsv('email;rôle;Prénom;NOM\nCoach@Club.fr;coach;Jean;DUPONT\n')).toEqual([
      { email: 'coach@club.fr', role: 'coach', firstName: 'Jean', lastName: 'DUPONT' },
    ])
  })

  it('refuse un rôle autre que coach / admin (jamais « player » ni faute de frappe)', () => {
    expect(() => parseStaffCsv('a@club.fr;player;Jean;DUPONT')).toThrow(/ligne 1/)
    expect(() => parseStaffCsv('a@club.fr;Admin;Jean;DUPONT')).toThrow(/ligne 1/)
    expect(() => parseStaffCsv('pas-un-email;admin;Jean;DUPONT')).toThrow(/ligne 1/)
  })
})

it('loginEmail accepte ce que le joueur tape', () => {
  expect(loginEmail(' Jean.Dupont ')).toBe('jean.dupont@joueurs.rnr')
})

it('generatePassword : 12 caractères sans ambiguïté', () => {
  expect(generatePassword()).toMatch(/^[a-km-np-zA-HJ-NP-Z2-9]{12}$/)
})

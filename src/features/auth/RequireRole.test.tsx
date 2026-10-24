// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RequireRole } from './RequireRole'
import { isWrongCredentials, toAuthEmail, type Role } from './useAuth'

// Session et profil simulés : on teste la garde, pas Supabase
const auth = vi.hoisted(() => ({ userId: undefined as string | undefined, role: null as string | null, profileError: false }))
vi.mock('./useAuth', async importOriginal => ({
  ...(await importOriginal<typeof import('./useAuth')>()),
  useSession: () => ({ isPending: false, data: auth.userId ? { user: { id: auth.userId } } : null }),
  useProfile: () => ({
    isPending: false, isError: auth.profileError, refetch: vi.fn(),
    data: auth.role && !auth.profileError ? { role: auth.role, first_name: 'Test' } : undefined,
  }),
  useSignOut: () => ({ mutate: vi.fn() }),
}))

function visit(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>page connexion</p>} />
        <Route path="/joueur" element={<RequireRole roles={['player']}><p>espace joueur</p></RequireRole>} />
        <Route path="/staff" element={<RequireRole roles={['coach', 'admin']}><p>espace staff</p></RequireRole>} />
        <Route path="*" element={<RequireRole />} />
      </Routes>
    </MemoryRouter>,
  )
}
const as = (role: Role | null, userId: string | null = 'u1') =>
  Object.assign(auth, { userId: userId ?? undefined, role, profileError: false })

afterEach(cleanup)

describe('RequireRole', () => {
  it('sans session : vers la connexion', () => {
    as(null, null)
    visit('/staff')
    screen.getByText('page connexion')
  })

  it('un joueur qui tape /staff est renvoyé vers son espace', () => {
    as('player')
    visit('/staff')
    screen.getByText('espace joueur')
  })

  it('le staff (coach ou admin) accède à /staff mais pas à /joueur', () => {
    as('coach')
    visit('/joueur')
    screen.getByText('espace staff')
    cleanup()
    as('admin')
    visit('/staff')
    screen.getByText('espace staff')
  })

  it('« / » envoie chacun vers son espace', () => {
    as('player')
    visit('/')
    screen.getByText('espace joueur')
  })

  it('compte sans profil : message, aucun espace', () => {
    as(null)
    visit('/joueur')
    screen.getByText('Compte non activé, contacte le staff.')
    expect(screen.queryByText('espace joueur')).toBeNull()
  })

  it('profil impossible à charger (réseau) : réessayer ou se déconnecter, aucun espace', () => {
    as('player')
    auth.profileError = true
    visit('/joueur')
    screen.getByText('Réessayer')
    screen.getByText('Se déconnecter')
    expect(screen.queryByText('espace joueur')).toBeNull()
  })
})

it('isWrongCredentials distingue mauvais mot de passe et coupure réseau', () => {
  expect(isWrongCredentials({ code: 'invalid_credentials' })).toBe(true)
  expect(isWrongCredentials(new TypeError('Failed to fetch'))).toBe(false)
  expect(isWrongCredentials(null)).toBe(false)
})

it('toAuthEmail : identifiant joueur ou e-mail staff', () => {
  expect(toAuthEmail(' Jean.Dupont ')).toBe('jean.dupont@joueurs.rnr')
  expect(toAuthEmail('Coach@Club.fr ')).toBe('coach@club.fr')
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PlayerLayout } from './PlayerLayout'

// État de forme simulé : on teste le verrou des onglets, pas Supabase
const form = vi.hoisted(() => ({ state: 'pending' as 'pending' | 'filled' | 'empty' | 'error' }))
vi.mock('../auth/useAuth', () => ({ useUserId: () => 'p1', useProfile: () => ({ data: { first_name: 'Test' } }) }))
vi.mock('../follow/feature', () => ({ useFeature: () => false, useReadOnlyTest: () => false })) // drapeau fermé : l'onglet reste « Forme »
vi.mock('../wellness/useWellness', () => ({
  useWellnessDay: () => ({
    isPending: form.state === 'pending', isSuccess: form.state === 'filled' || form.state === 'empty', isError: form.state === 'error',
    data: form.state === 'filled' ? { score: 20 } : form.state === 'empty' ? null : undefined,
  }),
}))

function visit(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/joueur" element={<PlayerLayout />}>
          <Route index element={<p>accueil</p>} />
          <Route path="forme" element={<p>page forme</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('PlayerLayout', () => {
  it('pendant le chargement : reste sur l\'onglet demandé, sans en montrer le contenu', () => {
    form.state = 'pending'
    visit('/joueur')
    expect(screen.queryByText('page forme')).toBeNull()
    expect(screen.queryByText('accueil')).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('état de forme rempli : accès à l\'accueil', () => {
    form.state = 'filled'
    visit('/joueur')
    expect(screen.getByText('accueil')).toBeTruthy()
  })

  it('pas encore rempli : renvoyé vers Forme', () => {
    form.state = 'empty'
    visit('/joueur')
    expect(screen.getByText('page forme')).toBeTruthy()
  })

  it('erreur de chargement : renvoyé vers Forme (verrou maintenu)', () => {
    form.state = 'error'
    visit('/joueur')
    expect(screen.getByText('page forme')).toBeTruthy()
  })
})

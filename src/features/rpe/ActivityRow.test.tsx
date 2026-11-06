// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ActivityRow } from './ActivityRow'

// Enregistrement simulé : la base répond OK, on vérifie le retour visible au joueur
vi.mock('./useRpe', () => ({
  useSaveLog: () => ({ isPending: false, isError: false, mutate: (_: unknown, o: { onSuccess: () => void }) => o.onSuccess() }),
  useSaveSkip: () => ({ isPending: false, isError: false, mutate: vi.fn() }),
  useDeleteSkip: () => ({ isPending: false, isError: false, mutate: vi.fn() }),
}))

afterEach(cleanup)

it('après l\'enregistrement, le joueur voit « Enregistré »', () => {
  const activity = { plannedSessionId: 's1', activityTypeId: 'video', name: 'Vidéo', requiresRpe: false, durationMin: 30 }
  const { rerender } = render(<ul><ActivityRow playerId="p1" date="2026-10-25" activity={activity} /></ul>)
  expect(screen.queryByText('Enregistré')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: "J'y étais" }))
  // la ligne arrive de la base au rechargement des données
  rerender(<ul><ActivityRow playerId="p1" date="2026-10-25" activity={activity} log={{ duration_min: 30, rpe: null, srpe: null, validated_at: null }} /></ul>)
  expect(screen.getByRole('status').textContent).toBe('Enregistré')
})

it('« Je n\'ai pas fait » : raison obligatoire, « Autre » demande une précision', () => {
  const activity = { plannedSessionId: 's1', activityTypeId: 'poste', name: 'Jeu au Poste', requiresRpe: true, durationMin: 60 }
  render(<ul><ActivityRow playerId="p1" date="2026-10-25" activity={activity} /></ul>)
  fireEvent.click(screen.getByRole('button', { name: "Je n'ai pas fait" }))
  const ok = screen.getByRole('button', { name: 'Valider' }) as HTMLButtonElement
  expect(ok.disabled).toBe(true)
  fireEvent.click(screen.getByLabelText('Autre'))
  expect(ok.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Précision'), { target: { value: 'Convocation lycée' } })
  expect(ok.disabled).toBe(false)
})

it('activité déclarée non faite : raison affichée, sans saisie de RPE', () => {
  const activity = { plannedSessionId: 's1', activityTypeId: 'poste', name: 'Jeu au Poste', requiresRpe: true, durationMin: 60 }
  render(<ul><ActivityRow playerId="p1" date="2026-10-25" activity={activity} skip={{ reason: 'malade', note: null }} /></ul>)
  expect(screen.getByText('Pas fait · Malade / douleur')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull()
})

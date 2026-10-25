// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ActivityRow } from './ActivityRow'

// Enregistrement simulé : la base répond OK, on vérifie le retour visible au joueur
vi.mock('./useRpe', () => ({
  useSaveLog: () => ({ isPending: false, isError: false, mutate: (_: unknown, o: { onSuccess: () => void }) => o.onSuccess() }),
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

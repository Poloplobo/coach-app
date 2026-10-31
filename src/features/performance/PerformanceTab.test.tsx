// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PerformanceTab } from './PerformanceTab'
import { COLOR_LABEL } from './gps'

// Hooks simulés : on teste l'écran, pas Supabase ni la RLS
const h = vi.hoisted(() => ({
  ratings: [] as { match_id: string; player_id: string; rater: 'player' | 'staff'; color: string }[],
  gps: [] as unknown[],
  mutate: vi.fn(),
}))
const ok = (data: unknown) => ({ isPending: false, isError: false, data })
vi.mock('../player/playerDay', () => ({ usePlayerDay: () => ({ playerId: 'p1', today: '2026-10-31' }) }))
vi.mock('../tests/MyGoals', () => ({ MyGoals: () => null }))
vi.mock('./usePerformance', () => ({
  useMatches: () => ok([{ id: 'm1', match_date: '2026-10-25', opponent: 'R92', label: null }]),
  useGpsRecords: () => ok(h.gps),
  useRatings: () => ok(h.ratings),
  useGpsReference: () => ok({ refs: new Map(), positions: new Map() }),
  useRateMatch: () => ({ mutate: h.mutate, isPending: false, isError: false }),
}))

const NOTE = 'Note ton match pour découvrir la note du staff.'
// Les 4 libellés existent déjà dans les boutons de notation : une couleur staff affichée les double
const occurrences = (label: string) => screen.getAllByText(label).length

beforeEach(() => { h.ratings = []; h.gps = []; h.mutate.mockClear() })
afterEach(cleanup)

describe('PerformanceTab', () => {
  it('sans note du joueur : invitation à noter, et aucune couleur staff même si les données en contiennent une', () => {
    h.ratings = [{ match_id: 'm1', player_id: 'p1', rater: 'staff', color: 'bleu' }]
    render(<PerformanceTab />)
    expect(screen.getByText(NOTE)).toBeTruthy()
    expect(occurrences(COLOR_LABEL.bleu)).toBe(1) // seulement le bouton de notation
  })

  it('avec sa note : la note du staff s\'affiche', () => {
    h.ratings = [{ match_id: 'm1', player_id: 'p1', rater: 'player', color: 'vert' }, { match_id: 'm1', player_id: 'p1', rater: 'staff', color: 'bleu' }]
    render(<PerformanceTab />)
    expect(screen.queryByText(NOTE)).toBeNull()
    expect(occurrences(COLOR_LABEL.bleu)).toBe(2)
  })

  it('sans GPS sur le match : message grisé, la note reste possible', () => {
    render(<PerformanceTab />)
    expect(screen.getByText('Pas de GPS pour toi sur ce match.')).toBeTruthy()
    const radios = screen.getAllByRole('radio') as HTMLButtonElement[]
    expect(radios).toHaveLength(4)
    expect(radios.every(r => !r.disabled)).toBe(true)
  })

  it('choisir une couleur n\'enregistre rien ; « Valider ma note » enregistre avec rater « player »', () => {
    render(<PerformanceTab />)
    fireEvent.click(screen.getByRole('radio', { name: COLOR_LABEL.jaune }))
    expect(h.mutate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Valider ma note' }))
    expect(h.mutate).toHaveBeenCalledWith({ match_id: 'm1', player_id: 'p1', rater: 'player', color: 'jaune' })
  })
})

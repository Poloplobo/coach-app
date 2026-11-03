// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WeekendSummary } from './WeekendSummary'

// Hooks simulés : on teste l'écran, la RLS cache déjà la note staff avant celle du joueur
const h = vi.hoisted(() => ({ ratings: [] as unknown[] }))
const ok = (data: unknown) => ({ isPending: false, isError: false, data })
vi.mock('./usePerformance', () => ({
  useMatches: () => ok([{ id: 'm1', match_date: '2026-11-01', opponent: 'ABCD XV', label: 'J3', home: null, logo: null }]),
  useRatings: () => ok(h.ratings),
  useGpsRecords: () => ok([]),
  useGpsReference: () => ok({ refs: new Map(), positions: new Map() }),
}))
const staff = { match_id: 'm1', player_id: 'p1', rater: 'staff', color: 'bleu', comment: 'Gros match', minutes: 65 }
const show = () => render(<MemoryRouter><WeekendSummary playerId="p1" /></MemoryRouter>)
afterEach(cleanup)

describe('WeekendSummary (accueil)', () => {
  it('sans sa note : invitation à noter, rien du coach', () => {
    h.ratings = [staff]
    show()
    expect(screen.getByText('après ta note')).toBeTruthy()
    expect(screen.queryByText('Très bon match')).toBeNull()
    expect(screen.queryByText(/Gros match/)).toBeNull()
    expect(screen.getByText('Noter mon match')).toBeTruthy()
  })
  it('avec sa note : note du coach, temps de jeu et commentaire', () => {
    h.ratings = [{ match_id: 'm1', player_id: 'p1', rater: 'player', color: 'vert' }, staff]
    show()
    expect(screen.getByText('Très bon match')).toBeTruthy()
    expect(screen.getByText('65 min')).toBeTruthy()
    expect(screen.getByText('« Gros match »')).toBeTruthy()
  })
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlayerSeason } from './MatchNotes'

// Hooks simulés : on teste l'écran, pas Supabase ni la RLS
const h = vi.hoisted(() => ({ mutate: vi.fn() }))
const ok = (data: unknown) => ({ isPending: false, isError: false, data })
vi.mock('recharts', async orig => ({ ...(await orig<typeof import('recharts')>()), ResponsiveContainer: () => null }))
vi.mock('../staff/useStaff', () => ({
  useRoster: () => ok([{ id: 'a', first_name: 'Léo', last_name: 'Martin' }, { id: 'b', first_name: 'Tom', last_name: 'Petit' }]),
}))
vi.mock('./usePerformance', () => ({
  useMatches: () => ok([
    { id: 'm2', match_date: '2026-11-01', opponent: 'ABCD XV', label: 'J3', home: null, logo: null },
    { id: 'm1', match_date: '2026-10-11', opponent: 'Racing 92', label: 'J1', home: null, logo: null },
  ]),
  useRatings: () => ok([
    { match_id: 'm1', player_id: 'b', rater: 'staff', color: 'vert', comment: null, minutes: 70 },
    { match_id: 'm1', player_id: 'b', rater: 'player', color: 'bleu' },
  ]),
  useRateMatch: () => ({ mutate: h.mutate, isPending: false, isError: false, isSuccess: false }),
}))

afterEach(cleanup)

describe('PlayerSeason', () => {
  it('un joueur choisi : résumé de sa saison et ses matchs, du plus récent au plus ancien', () => {
    render(<PlayerSeason />)
    fireEvent.change(screen.getByLabelText('Joueur'), { target: { value: 'b' } })
    expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent?.replace(/\s+/g, ' ').trim() ===
      '1 / 2 matchs notés par le coach · 1 match joué · 70 min de jeu sur 1 match saisi (moyenne 70 min)')).toBeTruthy()
    const groups = screen.getAllByRole('radiogroup').map(g => g.getAttribute('aria-label'))
    expect(groups).toEqual([expect.stringContaining('Petit Tom, J3 · ABCD XV'), expect.stringContaining('Petit Tom, J1 · Racing 92')])
  })

  it('le coach enregistre coq et temps de jeu ; un temps hors 0-120 bloque', () => {
    render(<PlayerSeason />)
    const [time] = screen.getAllByLabelText('Temps de jeu (min)')
    fireEvent.click(screen.getAllByRole('radio', { name: /Bon match/ })[0])
    fireEvent.change(time, { target: { value: '150' } })
    const [save] = screen.getAllByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement[]
    expect(save.disabled).toBe(true)
    fireEvent.change(time, { target: { value: '55' } })
    fireEvent.click(save)
    expect(h.mutate).toHaveBeenCalledWith({ match_id: 'm2', player_id: 'a', rater: 'staff', color: 'vert', comment: null, minutes: 55 })
  })
})

describe('PlayerRating : cohérence coq / temps de jeu', () => {
  it('« N\'a pas joué » met 0 min ; des minutes avec gris bloquent', () => {
    render(<PlayerSeason />)
    const [time] = screen.getAllByLabelText('Temps de jeu (min)') as HTMLInputElement[]
    fireEvent.click(screen.getAllByRole('radio', { name: /N'a pas joué/ })[0])
    expect(time.value).toBe('0')
    fireEvent.change(time, { target: { value: '30' } })
    expect((screen.getAllByRole('button', { name: 'Enregistrer' })[0] as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('N\'a pas joué : 0 min')).toBeTruthy()
  })
})

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSaveWellness } from '../wellness/useWellness'
import { useSaveLog } from '../rpe/useRpe'
import { useValidateSession } from '../seances/useSeance'

// Supabase simulé : on vérifie ce que les hooks envoient, la RLS est testée à part (npm run test:db)
const db = vi.hoisted(() => ({ upsert: vi.fn(), table: '', tables: [] as string[] }))
vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: (table: string) => { db.table = table; db.tables.push(table); return { upsert: db.upsert } } },
}))

function setup() {
  db.upsert.mockReset().mockResolvedValue({ error: null })
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  return { wrapper, invalidate }
}

describe('useSaveWellness', () => {
  it('une seule ligne par joueur et par jour : upsert sur (player_id, entry_date), avec la date de Paris fournie', async () => {
    const { wrapper, invalidate } = setup()
    const { result } = renderHook(() => useSaveWellness('p1'), { wrapper })
    result.current.mutate({ date: '2026-10-26', items: { sleep_quality: 4, fatigue: 3, soreness_upper: 5, soreness_lower: 3, stress: 2, mood: 4 } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(db.table).toBe('wellness_entries')
    expect(db.upsert).toHaveBeenCalledWith(
      { player_id: 'p1', entry_date: '2026-10-26', sleep_quality: 4, fatigue: 3, soreness_upper: 5, soreness_lower: 3, stress: 2, mood: 4 },
      { onConflict: 'player_id,entry_date' },
    )
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['wellness', 'p1'] })
  })

  it('remonte l\'erreur de la base (ex. jour passé refusé par la RLS)', async () => {
    const { wrapper } = setup()
    db.upsert.mockResolvedValue({ error: { message: 'new row violates row-level security policy' } })
    const { result } = renderHook(() => useSaveWellness('p1'), { wrapper })
    result.current.mutate({ date: '2026-10-25', items: { sleep_quality: 1, fatigue: 1, soreness_upper: 1, soreness_lower: 1, stress: 1, mood: 1 } })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useSaveLog', () => {
  it('une ligne par activité et par jour, sans source ni validation (la base impose « app »)', async () => {
    const { wrapper, invalidate } = setup()
    const { result } = renderHook(() => useSaveLog('p1'), { wrapper })
    result.current.mutate({ date: '2026-10-26', activityTypeId: 'video', plannedSessionId: 's1', durationMin: 25, rpe: null })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(db.table).toBe('session_logs')
    expect(db.upsert).toHaveBeenCalledWith(
      { player_id: 'p1', session_date: '2026-10-26', activity_type_id: 'video', planned_session_id: 's1', duration_min: 25, rpe: null },
      { onConflict: 'player_id,session_date,activity_type_id' },
    )
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sessionLogs', 'p1'] })
  })
})

describe('useValidateSession', () => {
  const base = { date: '2026-10-26', plannedSessionId: 's1', activityTypeId: 'muscu', durationMin: 60, rpe: 6 }

  it('note « non fait » les exercices sans réponse AVANT de verrouiller la séance', async () => {
    const { wrapper } = setup()
    db.tables = []
    const { result } = renderHook(() => useValidateSession('p1'), { wrapper })
    result.current.mutate({ ...base, unansweredExerciseIds: ['e2', 'e3'] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(db.tables).toEqual(['exercise_feedback', 'session_logs'])
    expect(db.upsert.mock.calls[0][0]).toEqual([
      { player_id: 'p1', planned_exercise_id: 'e2', status: 'non fait' },
      { player_id: 'p1', planned_exercise_id: 'e3', status: 'non fait' },
    ])
    expect(db.upsert.mock.calls[1][0]).toMatchObject({ planned_session_id: 's1', rpe: 6, duration_min: 60, validated_at: expect.any(String) })
  })

  it('tous les exercices remplis : seulement la validation', async () => {
    const { wrapper } = setup()
    db.tables = []
    const { result } = renderHook(() => useValidateSession('p1'), { wrapper })
    result.current.mutate({ ...base, unansweredExerciseIds: [] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(db.tables).toEqual(['session_logs'])
  })

  it('si le marquage « non fait » échoue, la séance n\'est pas verrouillée', async () => {
    const { wrapper } = setup()
    db.tables = []
    db.upsert.mockResolvedValueOnce({ error: { message: 'réseau' } })
    const { result } = renderHook(() => useValidateSession('p1'), { wrapper })
    result.current.mutate({ ...base, unansweredExerciseIds: ['e2'] })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(db.tables).toEqual(['exercise_feedback'])
  })
})

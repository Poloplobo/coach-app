import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { formatDay, parisDate } from '../../lib/week'
import { useProfile, useUserId } from '../auth/useAuth'
import { useWellnessDay } from '../wellness/useWellness'
import { TABS, isTabLocked, type PlayerDay } from './playerDay'

// Le jour de saisie suit l'heure de Paris, même si l'app reste ouverte après minuit
function useParisToday() {
  const [today, setToday] = useState(parisDate)
  useEffect(() => {
    const id = setInterval(() => setToday(parisDate()), 60_000)
    return () => clearInterval(id)
  }, [])
  return today
}

export function PlayerLayout() {
  const playerId = useUserId()
  const profile = useProfile(playerId)
  const today = useParisToday()
  const wellness = useWellnessDay(playerId, today)
  const { pathname } = useLocation()

  // Tant que l'état de forme du jour n'est pas confirmé (chargement, réseau coupé), on reste verrouillé
  const mustFillForm = !wellness.isSuccess || !wellness.data
  if (isTabLocked(pathname, mustFillForm)) return <Navigate to="/joueur/forme" replace />

  return (
    <div className="min-h-dvh pb-20">
      <main className="mx-auto max-w-md p-4 flex flex-col gap-4">
        <header>
          <h1 className="text-xl font-bold">Bonjour {profile.data?.first_name}</h1>
          <p className="text-sm text-ink/60 capitalize">{formatDay(today)}</p>
        </header>
        {wellness.isSuccess && !wellness.data && (
          <p role="status" className="rounded-lg border border-gold px-3 py-2 text-sm">
            Remplis ton état de forme du jour pour accéder au reste de l'application.
          </p>
        )}
        {wellness.isError && (
          <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">
            Impossible de vérifier ton état de forme. Vérifie ta connexion internet.
          </p>
        )}
        <Outlet key={today} context={{ playerId, today } satisfies PlayerDay} />
      </main>

      <nav aria-label="Navigation" className="fixed inset-x-0 bottom-0 border-t border-line bg-surface">
        <ul className="mx-auto max-w-md grid grid-cols-5">
          {TABS.map(t => (
            <li key={t.to}>
              {mustFillForm && t.locked ? (
                <span aria-disabled="true" className="flex h-16 flex-col items-center justify-center text-xs text-ink/30">
                  <span aria-hidden="true">🔒</span>{t.label}
                </span>
              ) : (
                <NavLink to={t.to} end
                  className={({ isActive }) => `flex h-16 items-center justify-center text-xs font-semibold ${isActive ? 'text-rnr' : 'text-ink/70'}`}>
                  {t.label}
                  {t.to === '/joueur/forme' && mustFillForm && <span className="ml-1 h-2 w-2 rounded-full bg-rnr" aria-label="à remplir" />}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

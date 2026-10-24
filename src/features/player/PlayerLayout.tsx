import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Dumbbell, HeartPulse, House, Lock, Settings, Users, type LucideIcon } from 'lucide-react'
import { Loading } from '../../components/ui/Loading'
import { formatDay, parisDate } from '../../lib/week'
import { useProfile, useUserId } from '../auth/useAuth'
import { useWellnessDay } from '../wellness/useWellness'
import { TABS, isTabLocked, type PlayerDay } from './playerDay'

const ICON: Record<string, LucideIcon> = {
  '/joueur': House, '/joueur/seance': Dumbbell, '/joueur/rugby': Users, '/joueur/forme': HeartPulse, '/joueur/reglages': Settings,
}

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
  // Pendant le chargement on attend sur place (sinon chaque ouverture de l'app renvoyait vers Forme, même rempli)
  const locked = isTabLocked(pathname, mustFillForm)
  if (locked && !wellness.isPending) return <Navigate to="/joueur/forme" replace />

  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <main className="mx-auto max-w-md px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] flex flex-col gap-4">
        <header className="flex items-center justify-between gap-3 pt-2">
          <div>
            <p className="text-sm text-ink/60 first-letter:uppercase">{formatDay(today)}</p>
            <h1 className="font-display text-3xl font-bold leading-tight">Salut {profile.data?.first_name}</h1>
          </div>
          <img src="/logo-rnr.svg" alt="" className="h-12" />
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
        {locked ? <Loading /> : <Outlet key={today} context={{ playerId, today } satisfies PlayerDay} />}
      </main>

      <nav aria-label="Navigation" className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto max-w-md grid grid-cols-5">
          {TABS.map(t => {
            const Icon = ICON[t.to]
            const tab = 'relative flex h-[4.5rem] flex-col items-center justify-center gap-1 font-display text-sm font-semibold tracking-wide'
            return (
              <li key={t.to}>
                {mustFillForm && t.locked ? (
                  <span aria-disabled="true" className={`${tab} text-ink/30`}>
                    <Lock size={20} aria-hidden="true" />{t.label}
                  </span>
                ) : (
                  // onglet actif : trait rouge en haut, comme une ligne d'en-but
                  <NavLink to={t.to} end
                    className={({ isActive }) => `${tab} ${isActive ? 'text-ink before:absolute before:inset-x-3 before:top-0 before:h-[3px] before:bg-rnr' : 'text-ink/55 hover:text-ink/80'}`}>
                    <span className="relative">
                      <Icon size={22} aria-hidden="true" />
                      {t.to === '/joueur/forme' && mustFillForm && <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-rnr ring-2 ring-surface" aria-label="à remplir" />}
                    </span>
                    {t.label}
                  </NavLink>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

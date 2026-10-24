import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { formatDay, parisDate } from '../../lib/week'
import { useProfile, useUserId } from '../auth/useAuth'

const TABS = [
  { to: '/staff', label: "Aujourd'hui" },
  { to: '/staff/semaine', label: 'Semaine' },
  { to: '/staff/musculation', label: 'Musculation' },
  { to: '/staff/joueur', label: 'Joueur' },
  { to: '/staff/reglages', label: 'Réglages' },
]

// Écrans staff : pensés pour l'ordinateur (desktop first), lisibles sur tablette
export function StaffLayout() {
  const profile = useProfile(useUserId())
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-x-8 gap-y-2">
          <div className="flex items-center gap-3">
            <img src="/logo-rnr.svg" alt="" className="h-9" />
            <div>
              <p className="font-bold leading-tight">Suivi PER</p>
              <p className="text-xs text-ink/60 capitalize">{formatDay(parisDate())} · {profile.data?.first_name} ({profile.data?.role === 'admin' ? 'admin' : 'coach'})</p>
            </div>
          </div>
          <nav aria-label="Navigation staff" className="flex gap-1">
            {TABS.map(t => (
              <NavLink key={t.to} to={t.to} end={t.to === '/staff'}
                className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-rnr text-white' : 'text-ink/70 hover:bg-app'}`}>
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 flex flex-col gap-4">
        <Suspense fallback={<p className="text-ink/60">Chargement…</p>}><Outlet /></Suspense>
      </main>
    </div>
  )
}

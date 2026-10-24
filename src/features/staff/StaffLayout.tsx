import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, ClipboardList, Dumbbell, Settings, Sun, User } from 'lucide-react'
import { formatDay, parisDate } from '../../lib/week'
import { useProfile, useUserId } from '../auth/useAuth'
import { Loading } from '../../components/ui/Loading'

const TABS = [
  { to: '/staff', label: "Aujourd'hui", icon: Sun },
  { to: '/staff/semaine', label: 'Semaine', icon: CalendarDays },
  { to: '/staff/musculation', label: 'Musculation', icon: Dumbbell },
  { to: '/staff/programmation', label: 'Programmation', icon: ClipboardList },
  { to: '/staff/joueur', label: 'Joueur', icon: User },
  { to: '/staff/reglages', label: 'Réglages', icon: Settings },
]

// Écrans staff : pensés pour l'ordinateur (desktop first), lisibles sur tablette
export function StaffLayout() {
  const profile = useProfile(useUserId())
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 flex flex-wrap items-center gap-x-8">
          <div className="flex items-center gap-3 py-2">
            <img src="/logo-rnr.svg" alt="" className="h-10" />
            <div>
              <p className="font-display text-xl font-bold leading-tight">Suivi PER</p>
              <p className="text-xs text-ink/60 first-letter:uppercase">{formatDay(parisDate())} · {profile.data?.first_name} ({profile.data?.role === 'admin' ? 'admin' : 'coach'})</p>
            </div>
          </div>
          <nav aria-label="Navigation staff" className="flex self-stretch overflow-x-auto">
            {TABS.map(t => (
              <NavLink key={t.to} to={t.to} end={t.to === '/staff'}
                className={({ isActive }) => `flex items-center gap-2 border-b-[3px] px-3 py-4 font-display text-lg font-semibold tracking-wide whitespace-nowrap ${isActive ? 'border-rnr text-ink' : 'border-transparent text-ink/60 hover:text-ink'}`}>
                <t.icon size={18} aria-hidden="true" />{t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 flex flex-col gap-5">
        <Suspense fallback={<Loading />}><Outlet /></Suspense>
      </main>
    </div>
  )
}

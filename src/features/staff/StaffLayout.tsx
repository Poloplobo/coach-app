import { Suspense, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { TabLink } from '../../components/ui/TabLink'
import { Activity, CalendarDays, ClipboardList, Dumbbell, Menu, Settings, Stethoscope, Sun, User, X, type LucideIcon } from 'lucide-react'
import { formatDay, parisDate } from '../../lib/week'
import { useProfile, useUserId } from '../auth/useAuth'
import { Loading } from '../../components/ui/Loading'
import { useRoster } from './useStaff'

type Tab = { to: string; label: string; icon: LucideIcon }
// Navigation regroupée par usage : le suivi du jour, la préparation, la santé
const GROUPS: { title: string; tabs: Tab[] }[] = [
  { title: 'Suivi', tabs: [
    { to: '/staff', label: "Aujourd'hui", icon: Sun },
    { to: '/staff/semaine', label: 'Semaine', icon: CalendarDays },
    { to: '/staff/joueur', label: 'Joueur', icon: User },
  ] },
  { title: 'Préparation', tabs: [
    { to: '/staff/musculation', label: 'Musculation', icon: Dumbbell },
    { to: '/staff/programmation', label: 'Programmation', icon: ClipboardList },
    { to: '/staff/performance', label: 'Performance', icon: Activity },
  ] },
  { title: 'Santé', tabs: [{ to: '/staff/medical', label: 'Médical', icon: Stethoscope }] },
]

// Écrans staff (desktop first) : barre latérale réduite aux icônes, qui s'agrandit par-dessus la page au survol de la souris
// (ou au clavier : focus visible, pas après un clic) ; téléphone : barre du haut et menu qui s'ouvre par-dessus (open)
export function StaffLayout() {
  const profile = useProfile(useUserId())
  const [open, setOpen] = useState(false)
  const label = open ? 'inline' : 'hidden group-hover:inline group-has-[:focus-visible]:inline', block = open ? 'block' : 'hidden group-hover:block group-has-[:focus-visible]:block'
  const injured = useRoster().data?.filter(p => p.injured).length ?? 0
  const name = [profile.data?.first_name, profile.data?.last_name].filter(Boolean).join(' ')
  const initials = `${profile.data?.first_name?.[0] ?? ''}${profile.data?.last_name?.[0] ?? ''}`.toUpperCase()

  const link = (t: Tab, count?: number) => (
    <TabLink key={t.to} to={t.to} end={t.to === '/staff'} title={t.label} onClick={() => setOpen(false)}
      className={({ isActive }) => `relative flex h-11 items-center gap-3 rounded-xl px-3 font-display text-lg font-semibold tracking-wide ${open ? '' : 'justify-center group-hover:justify-start group-has-[:focus-visible]:justify-start'} ${
        isActive ? 'bg-field text-ink' : 'text-ink/60 hover:bg-field hover:text-ink'}`}>
      {({ isActive }) => <>
        {/* repère de l'onglet actif : glisse d'un onglet à l'autre (index.css) */}
        {isActive && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-rnr [view-transition-name:tab-bar]" />}
        <t.icon size={19} aria-hidden="true" className="shrink-0" />
        <span className={`${label} flex-1 truncate`}>{t.label}</span>
        {count ? <span className={`rounded-full bg-gold/20 px-1.5 text-xs tabular-nums text-gold ${open ? '' : 'absolute right-1 top-1 group-hover:static group-has-[:focus-visible]:static'}`} aria-label={`${count} blessé${count > 1 ? 's' : ''}`}>{count}</span> : null}
      </>}
    </TabLink>
  )

  return (
    <div className="min-h-dvh">
      {/* Téléphone : barre du haut, le menu s'ouvre par-dessus l'écran */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line/60 bg-app/90 px-4 py-2 backdrop-blur md:hidden">
        <img src="/logo-rnr.svg" alt="" className="h-9" />
        <p className="flex-1 font-display text-xl font-bold">Suivi PER</p>
        <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-field"><Menu size={20} aria-hidden="true" /></button>
      </header>
      {open && <button type="button" aria-label="Fermer le menu" onClick={() => setOpen(false)} className="fixed inset-0 z-20 bg-app/70 md:hidden" />}
      <aside className={`group [view-transition-name:staff-header] fixed inset-y-0 left-0 z-30 p-2 ${open ? 'block w-64' : 'hidden w-[4.75rem] md:block md:hover:w-64 md:has-[:focus-visible]:w-64'}`}>
        <div className="flex h-full flex-col gap-5 overflow-hidden whitespace-nowrap rounded-2xl bg-surface p-2 ring-1 ring-line/60 group-hover:shadow-2xl group-hover:shadow-black/40 group-has-[:focus-visible]:shadow-2xl">
          <div className="flex items-center gap-3 px-1 pt-1">
            <img src="/logo-rnr.svg" alt="" className="h-10 shrink-0" />
            <div className={`${block} min-w-0 flex-1`}>
              <p className="font-display text-xl font-bold leading-tight">Suivi PER</p>
              <p className="text-xs text-ink/60">Pôle Espoir · RNR</p>
            </div>
            {open && <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className="flex h-11 w-11 items-center justify-center rounded-full bg-field"><X size={20} aria-hidden="true" /></button>}
          </div>
          <nav aria-label="Navigation staff" className="flex flex-1 flex-col gap-4 overflow-y-auto">
            {GROUPS.map(g => (
              <div key={g.title} className="flex flex-col gap-1">
                <p className={`${block} px-3 text-[11px] font-semibold uppercase tracking-wider text-ink/40`}>{g.title}</p>
                {g.tabs.map(t => link(t, t.to === '/staff/medical' ? injured : undefined))}
              </div>
            ))}
          </nav>
          <div className="flex flex-col gap-2 border-t border-line/60 pt-3">
            {link({ to: '/staff/reglages', label: 'Réglages', icon: Settings })}
            <div className="flex items-center gap-3 px-1" title={name}>
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rnr font-display text-sm font-bold text-white">{initials}</span>
              <div className={`${block} min-w-0`}>
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="truncate text-xs text-ink/60 first-letter:uppercase">{profile.data?.role === 'admin' ? 'admin' : 'coach'} · {formatDay(parisDate())}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex flex-col gap-5 px-4 py-6 md:pl-[5.5rem] lg:pr-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 [view-transition-name:page]">
          <Suspense fallback={<Loading />}><Outlet /></Suspense>
        </div>
      </main>
    </div>
  )
}

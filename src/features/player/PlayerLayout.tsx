import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { TabLink } from '../../components/ui/TabLink'
import { Activity, Dumbbell, Eye, HeartPulse, House, Lock, Settings, Users, type LucideIcon } from 'lucide-react'
import { Loading } from '../../components/ui/Loading'
import { formatDay } from '../../lib/week'
import { useParisToday } from '../../lib/useParisToday'
import { useProfile, useUserId } from '../auth/useAuth'
import { useWellnessDay } from '../wellness/useWellness'
import { TABS, isTabLocked, type PlayerDay } from './playerDay'

const ICON: Record<string, LucideIcon> = {
  '/joueur': House, '/joueur/seance': Dumbbell, '/joueur/rugby': Users, '/joueur/performance': Activity, '/joueur/forme': HeartPulse, '/joueur/reglages': Settings,
}

export function PlayerLayout() {
  const playerId = useUserId()
  const profile = useProfile(playerId)
  const today = useParisToday()
  const wellness = useWellnessDay(playerId, today)
  const { pathname } = useLocation()

  // Tant que l'état de forme du jour n'est pas confirmé (chargement, réseau coupé), on reste verrouillé
  // Compte de test (lecture seule, 0039) : il ne peut rien remplir, donc rien ne lui est verrouillé
  const testAccount = !!profile.data?.is_test
  const mustFillForm = !testAccount && (!wellness.isSuccess || !wellness.data)
  // Pendant le chargement on attend sur place (sinon chaque ouverture de l'app renvoyait vers Forme, même rempli)
  const locked = isTabLocked(pathname, mustFillForm)
  if (locked && !wellness.isPending) return <Navigate to="/joueur/forme" replace />

  return (
    <div className="min-h-dvh pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      {/* En-tête compact et collant : le nom, la date et les réglages restent à portée sans manger l'écran */}
      <header className="glass sticky top-0 z-20 border-b border-line/40 bg-app/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150 [view-transition-name:player-header]">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-2">
          <img src="/logo-rnr.svg" alt="" className="h-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink/60 first-letter:uppercase">{formatDay(today)}</p>
            <h1 className="truncate font-display text-xl font-bold leading-tight">Salut {profile.data?.first_name}</h1>
          </div>
          {/* Réglages dans l'en-tête : la barre du bas garde 5 onglets lisibles au pouce */}
          <TabLink to="/joueur/reglages" end aria-label="Réglages"
            className={({ isActive }) => `flex h-11 w-11 items-center justify-center rounded-full ${isActive ? 'bg-ink text-app' : 'bg-field text-ink/70 hover:text-ink'}`}>
            <Settings size={20} aria-hidden="true" />
          </TabLink>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-4 pt-4">
        {testAccount && <p role="status" className="flex items-center gap-2 rounded-xl bg-gold/10 px-3 py-2.5 text-sm font-semibold ring-1 ring-gold/40"><Eye size={16} aria-hidden="true" className="shrink-0 text-gold" />Compte de test : lecture seule, rien n'est enregistré.</p>}
        {wellness.isSuccess && !wellness.data && (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-gold/10 px-3 py-2.5 text-sm ring-1 ring-gold/40">
            <Lock size={16} aria-hidden="true" className="shrink-0 text-gold" />Remplis ton état de forme du jour pour accéder au reste de l'application.
          </p>
        )}
        {wellness.isError && (
          <p role="alert" className="rounded-xl bg-rnr/15 px-3 py-2.5 text-sm ring-1 ring-rnr/50">
            Impossible de vérifier ton état de forme. Vérifie ta connexion internet.
          </p>
        )}
        {/* « page » : seul le contenu s'anime au changement d'onglet (index.css) ; en-tête et barre restent fixes */}
        <div className="flex flex-col gap-6 [view-transition-name:page]">
          {locked ? <Loading /> : <Outlet key={today} context={{ playerId, today } satisfies PlayerDay} />}
        </div>
      </main>

      {/* Barre d'onglets flottante : pilule détachée du bord, l'onglet actif rempli */}
      <nav aria-label="Navigation" className="[view-transition-name:player-nav] fixed inset-x-0 bottom-0 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <ul className="glass mx-auto grid max-w-md grid-cols-5 gap-1 rounded-3xl bg-surface/80 p-1.5 shadow-lg shadow-black/30 ring-1 ring-line/60 backdrop-blur-xl backdrop-saturate-150">
          {TABS.filter(t => t.to !== '/joueur/reglages').map(t => {
            const Icon = ICON[t.to]
            const tab = 'relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl font-display text-xs font-semibold tracking-wide transition-transform duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100'
            return (
              <li key={t.to}>
                {mustFillForm && t.locked ? (
                  <TabLink to="/joueur/forme" aria-label={`${t.label} : verrouillé, remplis d'abord ton état de forme`} className={`${tab} text-ink/40`}>
                    <Lock size={20} aria-hidden="true" />{t.label}
                  </TabLink>
                ) : (
                  // onglet actif : trait rouge en haut, comme une ligne d'en-but
                  <TabLink to={t.to} end
                    className={({ isActive }) => `${tab} ${isActive ? 'text-app' : 'text-ink/60 hover:text-ink/75'}`}>
                    {({ isActive }) => <>
                    {/* un seul trait porte ce nom à la fois : le navigateur le fait glisser d'un onglet à l'autre */}
                    {isActive && <span aria-hidden="true" className="absolute inset-0 rounded-2xl bg-ink [view-transition-name:tab-bar]" />}
                    <span className="relative">
                      <Icon size={22} aria-hidden="true" />
                      {t.to === '/joueur/forme' && mustFillForm && <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-rnr ring-2 ring-surface" aria-label="à remplir" />}
                    </span>
                    <span className="relative">{t.label}</span>
                    </>}
                  </TabLink>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

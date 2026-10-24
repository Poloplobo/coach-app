import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { RequireRole } from './features/auth/RequireRole'
import { HomeTab } from './features/player/HomeTab'
import { PlayerLayout } from './features/player/PlayerLayout'
import { FormeTab, RugbyTab, SeanceTab } from './features/player/tabs'
import { SettingsTab } from './features/settings/SettingsTab'

// Espace staff (graphiques, export) chargé à part : les téléphones des joueurs ne le téléchargent jamais
const StaffLayout = lazy(() => import('./features/staff/StaffLayout').then(m => ({ default: m.StaffLayout })))
const TodayView = lazy(() => import('./features/staff/TodayView').then(m => ({ default: m.TodayView })))
const WeekView = lazy(() => import('./features/staff/WeekView').then(m => ({ default: m.WeekView })))
const PlayerView = lazy(() => import('./features/staff/PlayerView').then(m => ({ default: m.PlayerView })))

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/joueur" element={<RequireRole roles={['player']}><PlayerLayout /></RequireRole>}>
        <Route index element={<HomeTab />} />
        <Route path="seance" element={<SeanceTab />} />
        <Route path="rugby" element={<RugbyTab />} />
        <Route path="forme" element={<FormeTab />} />
        <Route path="reglages" element={<SettingsTab />} />
      </Route>
      <Route path="/staff" element={<RequireRole roles={['coach', 'admin']}><Suspense fallback={<p className="p-4 text-ink/60">Chargement…</p>}><StaffLayout /></Suspense></RequireRole>}>
        <Route index element={<TodayView />} />
        <Route path="semaine" element={<WeekView />} />
        <Route path="joueur/:playerId?" element={<PlayerView />} />
        <Route path="reglages" element={<div className="max-w-md flex flex-col gap-4"><SettingsTab /></div>} />
      </Route>
      {/* « / » et toute autre adresse : chacun est renvoyé vers son espace */}
      <Route path="*" element={<RequireRole />} />
    </Routes>
  )
}

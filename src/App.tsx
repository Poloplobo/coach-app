import { Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { RequireRole } from './features/auth/RequireRole'
import { Welcome } from './features/auth/Welcome'
import { HomeTab } from './features/player/HomeTab'
import { PlayerLayout } from './features/player/PlayerLayout'
import { FormeTab, RugbyTab, SeanceTab } from './features/player/tabs'
import { SettingsTab } from './features/settings/SettingsTab'

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
      <Route path="/staff/*" element={<RequireRole roles={['coach', 'admin']}><Welcome space="Espace staff" /></RequireRole>} />
      {/* « / » et toute autre adresse : chacun est renvoyé vers son espace */}
      <Route path="*" element={<RequireRole />} />
    </Routes>
  )
}

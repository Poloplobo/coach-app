import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from './lib/supabaseClient'
import App from './App'
import { applyTheme, storedTheme } from './features/settings/theme'
// Polices servies par l'app (pas d'appel à Google Fonts : rien ne part chez un tiers, et l'app marche hors ligne)
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow-condensed/500.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import './index.css'

applyTheme(storedTheme()) // avant le premier affichage : pas de flash de l'autre thème

// Écran d'ouverture (index.html) : retiré du DOM une fois son animation finie
const splash = document.getElementById('splash')
if (splash) Promise.all(splash.getAnimations({ subtree: true }).map(a => a.finished)).finally(() => splash.remove())

const queryClient = new QueryClient()
// Connexion, déconnexion et renouvellement du jeton mettent à jour la session partout.
// Toute fin de session (bouton, jeton expiré, autre onglet) vide le cache : rien d'un joueur ne reste pour le suivant.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') queryClient.clear()
  queryClient.setQueryData(['session'], session)
})

// Après une mise à jour, une page restée ouverte réclame des morceaux de code qui n'existent plus (le serveur renvoie
// la page HTML : « 'text/html' is not a valid JavaScript MIME type ») : on recharge une fois pour prendre la nouvelle version
window.addEventListener('vite:preloadError', event => {
  try {
    const last = Number(sessionStorage.getItem('reloadedForUpdate') ?? 0)
    if (Date.now() - last < 60_000) return // déjà rechargé il y a moins d'une minute : on laisse l'erreur s'afficher
    sessionStorage.setItem('reloadedForUpdate', String(Date.now()))
  } catch { /* stockage indisponible : on recharge quand même */ }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)

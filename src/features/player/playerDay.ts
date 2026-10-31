import { useOutletContext } from 'react-router-dom'

export type PlayerDay = { playerId: string; today: string }
export const usePlayerDay = () => useOutletContext<PlayerDay>()

// L'état de forme du jour est obligatoire : sans lui, Accueil, Séance et Rugby restent verrouillés
export const TABS = [
  { to: '/joueur', label: 'Accueil', locked: true },
  { to: '/joueur/seance', label: 'Séance', locked: true },
  { to: '/joueur/rugby', label: 'Rugby', locked: true },
  { to: '/joueur/performance', label: 'Perf', locked: true },
  { to: '/joueur/forme', label: 'Forme', locked: false },
  { to: '/joueur/reglages', label: 'Réglages', locked: false },
] as const

// Onglet atteignable ? (adresse inconnue = verrouillée, la mise en page redirige vers l'état de forme)
export function isTabLocked(pathname: string, mustFillForm: boolean) {
  const tab = TABS.find(t => t.to === pathname.replace(/\/$/, ''))
  return mustFillForm && tab?.locked !== false
}

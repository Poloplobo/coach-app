import { useState } from 'react'

export type Theme = 'dark' | 'light'
const KEY = 'rugby-tracker-theme'

// Préférence propre à l'appareil : le stockage peut être indisponible (navigation privée), on retombe sur le sombre
export function storedTheme(): Theme {
  try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem(KEY, theme) } catch { /* préférence non gardée, sans conséquence */ }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(storedTheme)
  return [theme, (t: Theme) => { applyTheme(t); setTheme(t) }] as const
}

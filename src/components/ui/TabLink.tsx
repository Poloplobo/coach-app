import { flushSync } from 'react-dom'
import { NavLink, useNavigate, type NavLinkProps } from 'react-router-dom'

// Lien d'onglet animé (View Transitions, voir index.css). La prop viewTransition de React Router
// n'agit qu'avec un routeur de données ; l'app utilise BrowserRouter, on déclenche donc la transition ici.
export function TabLink(props: NavLinkProps) {
  const navigate = useNavigate()
  return (
    <NavLink {...props} onClick={e => {
      props.onClick?.(e)
      // clic molette, ⌘-clic… : comportement normal du lien ; navigateur sans transitions : navigation directe
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !document.startViewTransition) return
      e.preventDefault()
      document.startViewTransition(() => flushSync(() => navigate(props.to)))
    }} />
  )
}

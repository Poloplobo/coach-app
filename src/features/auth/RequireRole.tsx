import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { homePath, useProfile, useSession, useSignOut, type Role } from './useAuth'

export function FullPageMessage({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">{children}</div>
}

// roles absent : toute personne connectée avec un profil (sert à rediriger « / » vers son espace)
export function RequireRole({ roles, children }: { roles?: Role[]; children?: ReactNode }) {
  const session = useSession()
  const userId = session.data?.user.id
  const profile = useProfile(userId)
  const signOut = useSignOut()

  if (session.isPending || (userId && profile.isPending)) return <FullPageMessage>Chargement…</FullPageMessage>
  if (!userId) return <Navigate to="/login" replace />
  const signOutButton = <Button variant="ghost" onClick={() => signOut.mutate()}>Se déconnecter</Button>
  if (profile.isError) {
    return (
      <FullPageMessage>
        <p>Impossible de charger ton profil. Vérifie ta connexion internet.</p>
        <Button onClick={() => profile.refetch()}>Réessayer</Button>
        {signOutButton}
      </FullPageMessage>
    )
  }
  if (!profile.data) {
    return (
      <FullPageMessage>
        <p>Compte non activé, contacte le staff.</p>
        {signOutButton}
      </FullPageMessage>
    )
  }
  if (!roles?.includes(profile.data.role)) return <Navigate to={homePath(profile.data.role)} replace />
  return children
}

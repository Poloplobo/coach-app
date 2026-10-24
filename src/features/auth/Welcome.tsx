import { Button } from '../../components/ui/Button'
import { FullPageMessage } from './RequireRole'
import { useProfile, useSession, useSignOut } from './useAuth'

// shortcut: page d'attente de l'espace staff, remplacée à l'étape 7
export function Welcome({ space }: { space: string }) {
  const session = useSession()
  const profile = useProfile(session.data?.user.id)
  const signOut = useSignOut()
  return (
    <FullPageMessage>
      <img src="/logo-rnr.svg" alt="" className="h-20" />
      <h1 className="text-xl font-bold">Bonjour {profile.data?.first_name}</h1>
      <p className="text-ink/70">{space}</p>
      <Button variant="ghost" onClick={() => signOut.mutate()}>Se déconnecter</Button>
    </FullPageMessage>
  )
}

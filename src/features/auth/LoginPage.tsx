import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { isWrongCredentials, useSession, useSignIn } from './useAuth'

export function LoginPage() {
  const session = useSession()
  const signIn = useSignIn()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')

  if (session.data) return <Navigate to="/" replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    signIn.mutate({ identifier, password })
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-4">
        <img src="/logo-rnr.svg" alt="Rouen Normandie Rugby" className="h-28 self-center" />
        <h1 className="font-display text-4xl font-bold text-center leading-none">Rugby Tracker</h1>
        <p className="-mt-2 mb-2 text-center text-sm text-ink/60">Crabos et Pôle Espoir</p>

        <label className="flex flex-col gap-1 text-sm">
          Identifiant
          <input
            value={identifier} onChange={e => setIdentifier(e.target.value)}
            autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required
            placeholder="prenom.nom"
            className="rounded-md bg-surface border border-line px-3 py-3 text-base focus:border-ink/50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Mot de passe
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            autoComplete="current-password" required
            className="rounded-md bg-surface border border-line px-3 py-3 text-base focus:border-ink/50"
          />
        </label>

        {signIn.isError && (
          <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">
            {isWrongCredentials(signIn.error)
              ? 'Identifiant ou mot de passe incorrect.'
              : 'Connexion impossible pour le moment. Vérifie ta connexion internet et réessaie.'}
          </p>
        )}
        <Button type="submit" disabled={signIn.isPending}>{signIn.isPending ? 'Connexion…' : 'Se connecter'}</Button>
        <p className="text-xs text-center text-ink/60">Mot de passe oublié ? Demande à un admin de le réinitialiser.</p>
      </form>
    </main>
  )
}

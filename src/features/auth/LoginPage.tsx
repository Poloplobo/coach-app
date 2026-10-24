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
        <img src="/logo-rnr.svg" alt="Rouen Normandie Rugby" className="h-24 self-center" />
        <h1 className="text-xl font-bold text-center">Rugby Tracker</h1>

        <label className="flex flex-col gap-1 text-sm">
          Identifiant
          <input
            value={identifier} onChange={e => setIdentifier(e.target.value)}
            autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required
            placeholder="prenom.nom"
            className="rounded-lg bg-surface border border-line px-3 py-3 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Mot de passe
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            autoComplete="current-password" required
            className="rounded-lg bg-surface border border-line px-3 py-3 text-base"
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

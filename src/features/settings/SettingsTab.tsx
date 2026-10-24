import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { MIN_PASSWORD_LENGTH, isWrongCredentials, useChangePassword, useProfile, useSession, useSignOut } from '../auth/useAuth'
import { PRIVACY_CONTACT, PRIVACY_SECTIONS } from './privacy'
import { useTheme } from './theme'

export function SettingsTab() {
  const session = useSession()
  const profile = useProfile(session.data?.user.id)
  const signOut = useSignOut()
  const [theme, setTheme] = useTheme()
  const email = session.data?.user.email ?? ''
  const identifier = email.endsWith('@joueurs.rnr') ? email.split('@')[0] : email

  return (
    <>
      <Card title="Mon compte">
        <p>{profile.data?.first_name} {profile.data?.last_name}</p>
        <p className="text-sm text-ink/70">Identifiant : {identifier}</p>
      </Card>

      <Card title="Apparence">
        <label className="flex items-center justify-between gap-3">
          Mode sombre
          <button type="button" role="switch" aria-checked={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`relative h-7 w-12 rounded-full border border-line ${theme === 'dark' ? 'bg-rnr' : 'bg-app'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white border border-line shadow transition-all ${theme === 'dark' ? 'left-6' : 'left-0.5'}`} />
          </button>
        </label>
      </Card>

      <ChangePassword />

      <Card title="Mes données (RGPD)">
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Lire la notice d'information</summary>
          <div className="mt-3 flex flex-col gap-3 text-sm">
            {PRIVACY_SECTIONS.map(s => (
              <div key={s.title}>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-ink/80">{s.text}</p>
              </div>
            ))}
            <p className="text-ink/80">
              Contact : {PRIVACY_CONTACT ? <a className="underline" href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a> : 'le staff du Pôle'}.
              Tu peux aussi saisir la CNIL (cnil.fr).
            </p>
          </div>
        </details>
      </Card>

      <Button variant="ghost" onClick={() => signOut.mutate()}>Se déconnecter</Button>
    </>
  )
}

function ChangePassword() {
  const change = useChangePassword()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH
  const mismatch = confirm.length > 0 && confirm !== password
  const ready = current.length > 0 && password.length >= MIN_PASSWORD_LENGTH && confirm === password

  const submit = (e: FormEvent) => {
    e.preventDefault()
    change.mutate({ current, next: password }, { onSuccess: () => { setCurrent(''); setPassword(''); setConfirm('') } })
  }

  return (
    <Card title="Changer mon mot de passe">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Mot de passe actuel
          <input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)}
            className="rounded-lg bg-app border border-line px-3 py-3 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nouveau mot de passe ({MIN_PASSWORD_LENGTH} caractères minimum)
          <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}
            className="rounded-lg bg-app border border-line px-3 py-3 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Confirmer
          <input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)}
            className="rounded-lg bg-app border border-line px-3 py-3 text-base" />
        </label>
        {tooShort && <p className="text-sm text-ink/70">Encore {MIN_PASSWORD_LENGTH - password.length} caractère(s).</p>}
        {mismatch && <p className="text-sm text-ink/70">Les deux mots de passe ne sont pas identiques.</p>}
        {change.isSuccess && <p role="status" className="rounded-lg border border-ok px-3 py-2 text-sm">Mot de passe changé.</p>}
        {change.isError && (
          <p role="alert" className="rounded-lg border border-rnr bg-rnr/15 px-3 py-2 text-sm">
            {isWrongCredentials(change.error) ? 'Mot de passe actuel incorrect.' : 'Changement impossible, réessaie.'}
          </p>
        )}
        <Button type="submit" disabled={!ready || change.isPending}>{change.isPending ? 'Enregistrement…' : 'Changer'}</Button>
      </form>
    </Card>
  )
}

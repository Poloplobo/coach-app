import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { ChevronRight } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { MIN_PASSWORD_LENGTH, isWrongCredentials, useChangePassword, useProfile, useSession, useSignOut } from '../auth/useAuth'
import { PRIVACY_CONTACT, PRIVACY_SECTIONS } from './privacy'
import { PLAYER_GUIDE, STAFF_GUIDE } from './guide'
import { useTheme } from './theme'
import { usePushState, useTogglePush } from './usePush'

export function SettingsTab() {
  const session = useSession()
  const profile = useProfile(session.data?.user.id)
  const signOut = useSignOut()
  const [theme, setTheme] = useTheme()
  const email = session.data?.user.email ?? ''
  const identifier = email.endsWith('@joueurs.rnr') ? email.split('@')[0] : email

  // Liste de réglages façon téléphone : une ligne par réglage, le détail se déplie sur demande
  const row = 'flex items-center justify-between gap-3 py-3'
  const fold = 'group py-3 [&_summary]:cursor-pointer [&_summary]:list-none'
  return (
    <Card title="Réglages">
      <div className="divide-y divide-line border-y border-line">
        <div className={row}>
          <span className="text-ink/60">Compte</span>
          <span className="text-right"><span className="font-semibold">{profile.data?.first_name} {profile.data?.last_name}</span>
            <span className="block text-sm text-ink/60">{identifier}</span></span>
        </div>
        <label className={row}>
          <span>Mode sombre</span>
          <button type="button" role="switch" aria-checked={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`relative h-7 w-12 rounded-full border border-line ${theme === 'dark' ? 'bg-rnr' : 'bg-field'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white border border-line shadow left-0.5 transition-transform duration-150 ease-out ${theme === 'dark' ? 'translate-x-[1.375rem]' : ''}`} />
          </button>
        </label>
        {profile.data?.role === 'player' && <MorningReminder className={row} />}
        {profile.data && (
          <details className={fold}>
            <summary className="flex items-center justify-between">Mode d'emploi <Chevron /></summary>
            <div className="mt-3 flex flex-col gap-4 text-sm">
              {(profile.data.role === 'player' ? PLAYER_GUIDE : STAFF_GUIDE).map(s => (
                <section key={s.title}>
                  <h3 className="font-semibold">{s.title}</h3>
                  <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-ink/80">{s.items.map(i => <li key={i}>{i}</li>)}</ul>
                </section>
              ))}
            </div>
          </details>
        )}
        <details className={fold}>
          <summary className="flex items-center justify-between">Changer mon mot de passe <Chevron /></summary>
          <div className="mt-3"><ChangePassword /></div>
        </details>
        <details className={fold}>
          <summary className="flex items-center justify-between">Mes données (RGPD) <Chevron /></summary>
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
      </div>
      <Button variant="ghost" className="w-full" onClick={() => signOut.mutate()}>Se déconnecter</Button>
    </Card>
  )
}

// Notification à 8h (et 10h si l'état de forme n'est pas rempli) sur ce téléphone
function MorningReminder({ className }: { className: string }) {
  const state = usePushState()
  const toggle = useTogglePush()
  if (state.isError) return <p className={`${className} text-sm text-ink/60`}>Rappel du matin : réglage indisponible pour l'instant (connexion ?).</p>
  if (!state.data || state.data === 'unavailable') return null
  const on = state.data === 'on'
  const hint = state.data === 'install' ? 'Sur iPhone : installe d\'abord l\'app (Partager → « Sur l\'écran d\'accueil »), puis ouvre-la depuis l\'icône.'
    : state.data === 'denied' ? 'Notifications bloquées pour l\'app : autorise-les dans les réglages du téléphone.'
      : on ? 'À 8h00, et à 10h00 si ton état de forme n\'est pas encore rempli.' : 'Une notification à 8h00 pour remplir ton état de forme.'
  return (
    <div className={className}>
      <span>Rappel du matin<span className="block text-sm text-ink/60">{hint}</span>
        {toggle.isError && <span role="alert" className="block text-sm text-rnr">Activation impossible, réessaie.</span>}</span>
      {(state.data === 'on' || state.data === 'off') && (
        <button type="button" role="switch" aria-checked={on} aria-label="Rappel du matin" disabled={toggle.isPending} onClick={() => toggle.mutate(!on)}
          className={`relative h-7 w-12 shrink-0 rounded-full border border-line ${on ? 'bg-rnr' : 'bg-field'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white border border-line shadow left-0.5 transition-transform duration-150 ease-out ${on ? 'translate-x-[1.375rem]' : ''}`} />
        </button>
      )}
    </div>
  )
}

const Chevron = () => <ChevronRight size={18} aria-hidden="true" className="text-ink/50 transition-transform group-open:rotate-90" />

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
    <>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Mot de passe actuel
          <input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)}
            className="rounded-md bg-field border border-line px-3 py-2.5 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nouveau mot de passe ({MIN_PASSWORD_LENGTH} caractères minimum)
          <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}
            className="rounded-md bg-field border border-line px-3 py-2.5 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Confirmer
          <input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)}
            className="rounded-md bg-field border border-line px-3 py-2.5 text-base" />
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
    </>
  )
}

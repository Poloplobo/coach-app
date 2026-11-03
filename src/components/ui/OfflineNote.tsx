// Saisie faite sans réseau : React Query la met en attente (isPaused) et l'envoie seule au retour de la connexion,
// tant que l'appli reste ouverte. Sans ce message, le bouton reste sur « Enregistrement… » sans explication.
export function OfflineNote({ shown }: { shown: boolean }) {
  return shown
    ? <p role="status" className="rounded-lg border border-gold bg-gold/10 px-3 py-2 text-sm">Pas de réseau : ta saisie partira dès que la connexion revient. Garde l'appli ouverte.</p>
    : null
}

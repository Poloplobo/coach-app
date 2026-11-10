import { usePhotoUrls } from './usePhotos'

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

// Pastille ronde à côté d'un nom (listes staff) ; sans photo : les initiales
export function Avatar({ id, name, className = 'h-8 w-8' }: { id: string; name: string; className?: string }) {
  const url = usePhotoUrls().data?.get(id)
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-field text-xs font-semibold text-ink/60 ring-1 ring-line ${className}`}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover object-top" loading="lazy" /> : initials(name)}
    </span>
  )
}

// Joueur détouré (fond transparent) pour les grandes cartes ; rien sans photo
export function Cutout({ id, className = 'h-32 w-32' }: { id: string; className?: string }) {
  const url = usePhotoUrls().data?.get(id)
  return url ? <img src={url} alt="" aria-hidden="true" className={`shrink-0 object-contain object-bottom ${className}`} /> : null
}

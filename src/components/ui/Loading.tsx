// Blocs gris à la place du texte « Chargement… » : la page garde sa forme pendant l'attente
export function Loading({ lines = 3 }: { lines?: number }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2 py-1">
      <span className="sr-only">Chargement…</span>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="h-3 rounded-sm bg-line/70 motion-safe:animate-pulse" style={{ width: `${90 - i * 22}%` }} />
      ))}
    </div>
  )
}

// Jauge de charge de la semaine : où en est le joueur par rapport à la plage de son type de semaine
// (REG 500-1500, COMP 1500-2500, DEV 2500 et plus). Positions en % de la largeur de la jauge.
export function loadGauge(load: number, min: number, max: number | null) {
  // L'échelle laisse de l'air au-dessus de la plage ; DEV (pas de maximum) : la plage va jusqu'au bout
  const scale = Math.max(max !== null ? max * 1.2 : min * 1.4, load * 1.05, 1)
  const pct = (v: number) => Math.round((1000 * Math.min(v, scale)) / scale) / 10
  return {
    fill: pct(Math.max(0, load)), bandFrom: pct(min), bandTo: max !== null ? pct(max) : 100,
    where: load < min ? 'below' as const : max !== null && load > max ? 'above' as const : 'in' as const,
  }
}

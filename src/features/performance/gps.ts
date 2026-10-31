// Analyse GPS d'un match, reprise du classeur « GPS - MATCH » (attendus aux postes A. Peters 2023).
// Fonctions pures, testées : l'écran joueur, la vue staff et les PowerPoint utilisent les mêmes chiffres.

export type GpsReference = { position_group: string; distance_m: number; accelerations: number; hi_distance_m: number; ref_minutes: number }
export type GpsRecord = { match_id: string; player_id: string; position: string; minutes: number; distance_m: number; hi_distance_m: number; accelerations: number; vmax: number | null }
export type GpsColor = 'rouge' | 'jaune' | 'vert' | 'bleu'

// Couleur selon le nombre d'attendus remplis (distance totale, distance HI, accélérations) : 0 → rouge … 3 → bleu
export const GPS_COLORS: GpsColor[] = ['rouge', 'jaune', 'vert', 'bleu']

// Poste saisi (export GPS ou fiche joueur) → groupe de poste du référentiel ; null si poste inconnu (à ajouter par le staff)
export const positionGroup = (position: string | null, positions: Map<string, string>) =>
  (position ? positions.get(position.trim().toUpperCase()) : undefined) ?? null

export function gpsAnalysis(r: Pick<GpsRecord, 'minutes' | 'distance_m' | 'hi_distance_m' | 'accelerations'>, ref: GpsReference | null) {
  if (!ref || r.minutes <= 0) return null
  // Ramené à un match de ref_minutes (70) : un joueur sorti à la 40e est comparé à l'attendu sur 70 minutes
  const coefficient = ref.ref_minutes / r.minutes
  const pct = (value: number, expected: number) => (100 * value * coefficient) / expected
  const raw = { distance: pct(r.distance_m, ref.distance_m), hi: pct(r.hi_distance_m, ref.hi_distance_m), accelerations: pct(r.accelerations, ref.accelerations) }
  // Seuil sur la valeur exacte : 99,6 % s'affiche 100 % mais n'est pas un attendu rempli (comme le classeur)
  const filled = Object.values(raw).filter(v => v >= 100).length
  return {
    coefficient: Math.round(coefficient * 100) / 100,
    pct: { distance: Math.round(raw.distance), hi: Math.round(raw.hi), accelerations: Math.round(raw.accelerations) },
    filled,
    color: GPS_COLORS[filled],
  }
}

// Vmax d'un joueur, match par match dans l'ordre des dates : record avant le match, meilleure à date, record battu
export function vmaxTimeline(records: { date: string; vmax: number | null }[], reference: number | null = null) {
  let best = reference
  return [...records].sort((a, b) => a.date.localeCompare(b.date)).map(r => {
    const before = best
    if (r.vmax !== null && (best === null || r.vmax > best)) best = r.vmax
    return {
      date: r.date, vmax: r.vmax, recordBefore: before, bestToDate: best,
      pctOfBest: r.vmax !== null && best ? Math.round((100 * r.vmax) / best) : null,
      record: r.vmax !== null && before !== null && r.vmax > before,
      first: before === null && r.vmax !== null, // première mesure : pas encore de record à battre
    }
  })
}

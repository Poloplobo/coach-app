// Analyse GPS d'un match, reprise du classeur « GPS - MATCH » (attendus aux postes A. Peters 2023).
// Fonctions pures, testées : l'écran joueur, la vue staff et les PowerPoint utilisent les mêmes chiffres.
import { BRAND } from '../../lib/brand'

export type GpsReference = { position_group: string; distance_m: number; accelerations: number; hi_distance_m: number; ref_minutes: number }
export type GpsRecord = { match_id: string; player_id: string; position: string; minutes: number; distance_m: number; hi_distance_m: number; accelerations: number; vmax: number | null }
export type GpsColor = 'rouge' | 'jaune' | 'vert' | 'bleu'
// Note de match : les 4 couleurs du coq, plus le gris « pas évaluable » (jamais une couleur GPS)
export type RatingColor = GpsColor | 'gris'

// Couleur selon le nombre d'attendus remplis (distance totale, distance HI, accélérations) : 0 → rouge … 3 → bleu
export const GPS_COLORS: GpsColor[] = ['rouge', 'jaune', 'vert', 'bleu']

// Couleur GPS (attendus remplis) : libellés de niveau, utilisés par les écrans et rapports GPS
export const RATING_COLORS: RatingColor[] = [...GPS_COLORS, 'gris']
export const COLOR_LABEL: Record<RatingColor, string> = {
  rouge: 'En dessous du niveau', jaune: 'Niveau moyen', vert: 'Bon niveau Crabos', bleu: 'A dominé le niveau', gris: 'Pas évaluable',
}
// Note de match (joueur et coach), indépendante des GPS (décisions du 02/11 et du 03/11/2026 : rouge et gris renommés)
export const RATING_LABEL: Record<RatingColor, string> = {
  gris: 'Pas évaluable', rouge: 'Pas au niveau attendu', jaune: 'Match moyen', vert: 'Bon match', bleu: 'Très bon match',
}

// Poste saisi (export GPS ou fiche joueur) → groupe de poste du référentiel ; null si poste inconnu (à ajouter par le staff)
export const positionGroup = (position: string | null, positions: Map<string, string>) =>
  (position ? positions.get(position.trim().replace(/\s+/g, ' ').toUpperCase()) : undefined) ?? null

// Sous 20 min jouées, ramener à 70 min n'a pas de sens (2 min → 500 %) : chiffres affichés, ni % ni couleur
export const MIN_MINUTES = 20

export function gpsAnalysis(r: Pick<GpsRecord, 'minutes' | 'distance_m' | 'hi_distance_m' | 'accelerations'>, ref: GpsReference | null) {
  if (!ref || r.minutes < MIN_MINUTES) return null
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

// Graphique de l'année (espace Match) : note sur une échelle de rouge à bleu ; gris (pas évaluable) n'est pas une note
export const RATING_SCORE: Record<GpsColor, number> = { rouge: 1, jaune: 2, vert: 3, bleu: 4 }
// Couleurs des coqs pour les graphiques (Recharts attend des valeurs, pas des classes)
export const RATING_HEX: Record<RatingColor, string> = { rouge: BRAND.rnr, jaune: BRAND.gold, vert: BRAND.ok, bleu: BRAND.blue, gris: BRAND.muted }
const score = (c?: RatingColor) => c && c !== 'gris' ? RATING_SCORE[c] : null

type SeasonMatch = { id: string; match_date: string; opponent: string; label: string | null }
type SeasonRating = { match_id: string; player_id: string; rater: 'player' | 'staff'; color: RatingColor; minutes?: number | null }

// Matchs du plus ancien au plus récent avec la note du coach et celle du joueur (null : pas notée ou pas évaluable)
export function ratingSeason(matches: SeasonMatch[], ratings: SeasonRating[], playerId: string) {
  const mine = ratings.filter(r => r.player_id === playerId)
  return [...matches].sort((a, b) => a.match_date.localeCompare(b.match_date)).map(m => {
    const staff = mine.find(r => r.match_id === m.id && r.rater === 'staff')
    const own = mine.find(r => r.match_id === m.id && r.rater === 'player')
    return {
      match: m, name: m.label ?? m.opponent,
      staff: score(staff?.color), player: score(own?.color),
      staffColor: staff?.color ?? null, playerColor: own?.color ?? null, minutes: staff?.minutes ?? null,
    }
  })
}

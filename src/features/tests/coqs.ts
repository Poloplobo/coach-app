// Coqs FFR « Génération bleue » (0044) : barème par poste, l'échelon inférieur quand on est entre deux seuils.
// Fonctions pures, testées.
import type { GpsColor } from '../performance/gps'

export type Reference = { test_id: string; position_group: string; blue: number; green: number; yellow: number }

// Poste de la fiche joueur (profiles.position) → colonne du barème FFR ; charnière : barème du demi de mêlée (comme le GPS)
export function ffrPosition(position: string | null): string | null {
  const p = (position ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  if (/pilier/.test(p)) return 'Pilier'
  if (/talon/.test(p)) return 'Talonneur'
  if (/2(e|eme)?\s*ligne/.test(p)) return '2e ligne'
  if (/3(e|eme)?\s*ligne/.test(p)) return '3e ligne'
  if (/charniere|melee/.test(p)) return 'Demi de mêlée'
  if (/ouverture|ouvreur/.test(p)) return "Demi d'ouverture"
  if (/centre/.test(p)) return 'Centre'
  if (/ailier/.test(p)) return 'Ailier'
  if (/arriere/.test(p)) return 'Arrière'
  return null
}

// Le barème est en 1RM (développé couché, back squat). 3RM → 1RM estimé (Brzycki : × 36/34) ; front squat → back squat
// estimé (front ≈ 85 % du back, décision du 10/11/2026 : estimation signalée à l'écran)
const BRZYCKI_3RM = 36 / 34
const CONVERSIONS: Record<string, { scale: string; factor: number; note: string }> = {
  'Développé Couché 3RM': { scale: 'Développé Couché 1RM', factor: BRZYCKI_3RM, note: '1RM estimé depuis le 3RM' },
  'Front Squat 3RM': { scale: 'Back Squat 1RM', factor: BRZYCKI_3RM / 0.85, note: 'back squat 1RM estimé depuis le front squat 3RM' },
  'Front Squat 1RM': { scale: 'Back Squat 1RM', factor: 1 / 0.85, note: 'back squat estimé depuis le front squat' },
}

export function scaleOf(testName: string) {
  return CONVERSIONS[testName] ?? { scale: testName, factor: 1, note: null }
}

export function coqOf(value: number, ref: Pick<Reference, 'blue' | 'green' | 'yellow'>, higherIsBetter: boolean): GpsColor {
  const ok = (threshold: number) => (higherIsBetter ? value >= threshold : value <= threshold)
  return ok(Number(ref.blue)) ? 'bleu' : ok(Number(ref.green)) ? 'vert' : ok(Number(ref.yellow)) ? 'jaune' : 'rouge'
}

// Coq d'un résultat : barème du test (ou de son équivalent 1RM), au poste du joueur ; null sans barème ou sans poste
export function testCoq(r: { testName: string; value: number; higherIsBetter: boolean; position: string | null },
  refs: Reference[], defs: { id: string; name: string }[]) {
  const pos = ffrPosition(r.position)
  const s = scaleOf(r.testName)
  const scaleId = defs.find(d => d.name === s.scale)?.id
  const ref = refs.find(x => x.test_id === scaleId && x.position_group === pos)
  if (!ref) return null
  const value = r.value * s.factor
  return { color: coqOf(value, ref, r.higherIsBetter), value, estimated: s.factor !== 1, note: s.note, ref }
}

export const COQ_LABEL: Record<GpsColor, string> = { bleu: 'bleu (premium)', vert: 'vert (très bon)', jaune: 'jaune (bon)', rouge: 'rouge (à améliorer)' }

// Podium du groupe par test (même règle que my_test_medals, 0044) : dernier résultat de chaque joueur, 3 meilleurs
// valeurs distinctes ; ex aequo = même médaille
export function groupPodium(latest: { player_id: string; test_id: string; value: number; higherIsBetter: boolean }[]) {
  const medals = new Map<string, 'or' | 'argent' | 'bronze'>() // clé : joueur|test
  for (const testId of new Set(latest.map(l => l.test_id))) {
    const rows = latest.filter(l => l.test_id === testId)
    const best = [...new Set(rows.map(r => r.value))].sort((a, b) => (rows[0].higherIsBetter ? b - a : a - b)).slice(0, 3)
    for (const r of rows) {
      const rank = best.indexOf(r.value)
      if (rank >= 0) medals.set(`${r.player_id}|${testId}`, (['or', 'argent', 'bronze'] as const)[rank])
    }
  }
  return medals
}

// Module médical (étape 13) : avancement d'un plan de retour et rapport d'épidémiologie du groupe. Fonctions pures, testées.
import { addDays } from '../../lib/week'

// Classement du consensus World Rugby / CIO (2020), mêmes valeurs que la base (0036)
export const LOCATIONS = {
  tete: 'Tête / visage', cou: 'Cou', epaule: 'Épaule', bras: 'Bras / coude', poignet_main: 'Poignet / main', thorax: 'Thorax',
  abdomen: 'Abdomen', lombaire_bassin: 'Lombaire / bassin', hanche_aine: 'Hanche / aine', cuisse: 'Cuisse', genou: 'Genou',
  jambe: 'Jambe / Achille', cheville: 'Cheville', pied: 'Pied',
} as const
export const TISSUES = {
  muscle_tendon: 'Muscle / tendon', nerveux: 'Nerveux (dont commotion)', os: 'Os', cartilage: 'Cartilage / synovie / bourse',
  ligament: 'Ligament / capsule', peau: 'Peau / contusion', non_specifique: 'Non spécifique',
} as const
export const MECHANISMS = {
  plaquant: 'Plaquant', plaque: 'Plaqué', ruck: 'Ruck', maul: 'Maul', melee: 'Mêlée', touche: 'Touche', collision: 'Collision',
  sans_contact: 'Sans contact (course, appui…)', autre: 'Autre',
} as const
export const ACTIVITIES = { match: 'Match', entrainement: 'Entraînement rugby', musculation: 'Musculation / prépa', hors_rugby: 'Hors rugby' } as const
export const ONSETS = { soudaine: 'Soudaine (traumatique)', progressive: 'Progressive (surmenage)' } as const

export type Step = {
  id: string; position: number; title: string; criteria: string | null; planned_days: number; validated_on: string | null
  // plan détaillé (0040) : phase et sa durée, objectifs, actions prépa ; kiné et commentaire côté staff seulement
  phase?: string | null; phase_days?: number | null; objectives?: string | null; prepa_actions?: string | null
  kine_actions?: string | null; comment?: string | null; is_test?: boolean; in_progress?: boolean
}

// Étapes regroupées par phase, dans l'ordre (plan sans phase : un seul groupe sans titre)
export function byPhase<S extends Step>(steps: S[]) {
  const groups: { phase: string | null; days: number | null; steps: S[] }[] = []
  for (const s of [...steps].sort((a, b) => a.position - b.position)) {
    const last = groups.at(-1)
    if (last && last.phase === (s.phase ?? null)) last.steps.push(s)
    else groups.push({ phase: s.phase ?? null, days: s.phase_days ?? null, steps: [s] })
  }
  return groups
}

const days = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

// Étape en cours (la première non validée), temps théorique restant et date de retour estimée. L'étape en cours a commencé
// à la validation de la précédente (ou à la blessure) ; ses jours déjà passés sont déduits, sans descendre sous 0.
export function planProgress(steps: Step[], occurredOn: string, today: string) {
  const ordered = [...steps].sort((a, b) => a.position - b.position)
  const current = ordered.find(s => !s.validated_on) ?? null
  const done = ordered.filter(s => s.validated_on).length
  if (!current) return { ordered, current, index: ordered.length, done, total: ordered.length, remainingDays: 0, returnDate: null as string | null }
  // Début de l'étape en cours : validation de l'étape validée juste avant elle (même si une étape a été validée dans le désordre)
  const startedOn = ordered.filter(s => s.validated_on && s.position < current.position).at(-1)?.validated_on ?? occurredOn
  const left = ordered.filter(s => !s.validated_on && s.position > current.position).reduce((n, s) => n + s.planned_days, 0)
  const remainingDays = Math.max(0, current.planned_days - days(startedOn, today)) + left
  return { ordered, current, index: ordered.indexOf(current), done, total: ordered.length, remainingDays, returnDate: addDays(today, remainingDays) }
}

export type InjuryRecord = {
  id: string; player_id: string; occurred_on: string; ended_on: string | null; location: string | null; tissue: string | null
  mechanism: string | null; onset: string | null; activity: string | null; recurrence: boolean
  alerts: { alert_days?: number; wellness_days?: number; items_at_1?: Record<string, number>; acute?: number; chronic?: number }
}

// Rapport d'épidémiologie sur une période : blessures survenues dans la période ; incidence pour 1000 h d'exposition
// (minutes déclarées à l'entraînement, minutes de match saisies par le coach) ; poids = jours perdus pour 1000 h.
export function epidemiology(injuries: InjuryRecord[], exposure: { trainingMin: number; matchMin: number }, from: string, to: string, today: string) {
  const list = injuries.filter(i => i.occurred_on >= from && i.occurred_on <= to)
  const lost = (i: InjuryRecord) => days(i.occurred_on, i.ended_on ?? today)
  const hours = (exposure.trainingMin + exposure.matchMin) / 60
  const per1000 = (n: number, h: number) => (h > 0 ? Math.round((10_000 * n) / h) / 10 : null)
  const count = (key: 'location' | 'tissue' | 'mechanism' | 'activity') =>
    Object.entries(list.reduce<Record<string, number>>((m, i) => { const k = i[key] ?? 'non_renseigne'; m[k] = (m[k] ?? 0) + 1; return m }, {}))
      .sort((a, b) => b[1] - a[1])
  const withAlerts = list.filter(i => (i.alerts.alert_days ?? 0) > 0)
  return {
    count: list.length, open: list.filter(i => !i.ended_on).length, hours: Math.round(hours),
    incidence: per1000(list.length, hours),
    matchIncidence: per1000(list.filter(i => i.activity === 'match').length, exposure.matchMin / 60),
    trainingIncidence: per1000(list.filter(i => i.activity === 'entrainement' || i.activity === 'musculation').length, exposure.trainingMin / 60),
    daysLost: list.reduce((n, i) => n + lost(i), 0),
    burden: per1000(list.reduce((n, i) => n + lost(i), 0), hours),
    recurrences: list.filter(i => i.recurrence).length,
    byLocation: count('location'), byTissue: count('tissue'), byMechanism: count('mechanism'), byActivity: count('activity'),
    // Alertes avant blessure : part des blessures précédées d'au moins un jour d'état de forme en alerte (28 jours)
    withAlerts: withAlerts.length,
    items: Object.entries(list.reduce<Record<string, number>>((m, i) => {
      for (const [k, n] of Object.entries(i.alerts.items_at_1 ?? {})) m[k] = (m[k] ?? 0) + n
      return m
    }, {})).sort((a, b) => b[1] - a[1]),
  }
}

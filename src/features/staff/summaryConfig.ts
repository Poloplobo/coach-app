// Seuils des résumés bloc / cycle / coach (codes couleur du tableau coach, synthèse automatique).
// Les seuils qui existaient déjà restent à leur place : plages de charge par type de semaine (base, week_types),
// alerte d'état de forme (WELLNESS_ALERT_SCORE, load.ts), zones du ratio aigu / chronique (acwr, load.ts).
export const SUMMARY = {
  attendance: { ok: 90, warn: 75 },      // % de présences : vert à partir de 90, orange à partir de 75, rouge en dessous
  weeksOutOfRange: { warn: 1, bad: 2 },  // semaines terminées hors de la plage de charge : orange dès 1, rouge dès 2
  alerts: { warn: 1, bad: 3 },           // alertes d'état de forme sur la période : orange dès 1, rouge dès 3
  loadChangePct: 10,                     // écart de charge avec le bloc précédent signalé dans la synthèse au-delà de ± 10 %
  fatigue: { warn: 40, bad: 55 },        // fatigue moyenne (%) : orange dès 40, rouge dès 55
} as const

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral'
// Plus c'est haut, mieux c'est (présences)
export const toneHigh = (v: number | null, t: { ok: number; warn: number }): Tone => (v === null ? 'neutral' : v >= t.ok ? 'ok' : v >= t.warn ? 'warn' : 'bad')
// Plus c'est bas, mieux c'est (alertes, semaines hors plage, fatigue)
export const toneLow = (v: number | null, t: { warn: number; bad: number }): Tone => (v === null ? 'neutral' : v >= t.bad ? 'bad' : v >= t.warn ? 'warn' : 'ok')

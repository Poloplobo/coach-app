// data/import/rpe_historique.json → une ligne session_logs par activité déclarée
import { z } from 'zod'
import { nameKey } from './names'

const Answer = z.object({
  joueur: z.string(),
  horodatage: z.string(),
  semaine: z.string(),
  date_seance: z.iso.date(),
  statut: z.string(),
  total_srpe_formulaire: z.number(),
  activites: z.array(z.object({
    libelle: z.string(),
    rpe: z.number().min(0).max(10),
    duree_min: z.number().int().positive(),
  })),
})
const RpeFile = z.object({ reponses: z.array(Answer) })

export type RpeLog = {
  playerKey: string; date: string; activity: string; durationMin: number; rpe: number; validatedAt: string
}

// Heure de Paris → instant UTC (le formulaire donne l'heure locale sans fuseau)
function parisToIso(local: string): string {
  const name = new Date(`${local}Z`).toLocaleString('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'longOffset' })
  return `${local}${name.match(/GMT([+-]\d{2}:\d{2})/)?.[1] ?? '+00:00'}`
}

// Seules les réponses « ok » sont importées : doublons et orphelines sont écartés (voir A_VERIFIER_RPE.md)
export function parseRpe(json: unknown) {
  const all = RpeFile.parse(json).reponses
  const answers = all.filter(a => a.statut === 'ok')

  const logs: RpeLog[] = answers.flatMap(a => a.activites.map(act => ({
    playerKey: nameKey(a.joueur),
    date: a.date_seance,
    activity: act.libelle,
    durationMin: act.duree_min,
    rpe: act.rpe,
    validatedAt: parisToIso(a.horodatage),
  })))

  const seen = new Set<string>()
  for (const l of logs) {
    const key = `${l.playerKey} | ${l.date} | ${l.activity}`
    if (seen.has(key)) throw new Error(`activité déclarée deux fois : ${key}`)
    seen.add(key)
  }

  // Totaux du formulaire par joueur et par semaine, pour contrôler l'import
  const expectedTotals = new Map<string, number>()
  for (const a of answers) {
    const key = `${nameKey(a.joueur)} | ${a.semaine}`
    expectedTotals.set(key, (expectedTotals.get(key) ?? 0) + a.total_srpe_formulaire)
  }

  return { logs, expectedTotals, skipped: all.length - answers.length }
}

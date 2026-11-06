// Plan de réhabilitation Excel (« PLAN DE RÉHABILITATION - <Joueur> ») : une ligne d'en-tête
// Étape | Objectifs | Actions Kiné | Actions Prépa | Statut | Commentaires, des lignes « Phase N : … - 14 JOURS »,
// des étapes, et des tests / contrôles (titre en capitales) dont la date est dans Commentaires.
import * as XLSX from 'xlsx'
import { addDays } from '../../lib/week'

export type ImportedStep = {
  title: string; phase: string | null; phase_days: number | null; planned_days: number; validated_on: string | null
  objectives: string | null; kine_actions: string | null; prepa_actions: string | null; comment: string | null
  is_test: boolean; in_progress: boolean
}
export type RehabPlan = { heading: string; steps: ImportedStep[] }

const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase()
const text = (v: unknown) => String(v ?? '').trim() || null
const iso = (d: Date) => d.toISOString().slice(0, 10)

// Date Excel (lue en Date grâce à cellDates, calendrier 1904 des Mac compris) ou « 06/10/2026 », même dans un texte
function toDate(v: unknown, inText = false): string | null {
  if (v instanceof Date) return isNaN(+v) ? null : iso(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(), 12)))
  if (typeof v === 'number' && v > 30000 && v < 80000) return iso(new Date(Math.round((v - 25569) * 86400000)))
  const m = String(v ?? '').trim().match(inText ? /(\d{1,2})\/(\d{1,2})\/(\d{4})/ : /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const d = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return iso(new Date(`${d}T12:00:00Z`)) === d ? d : null // refuse « 31/02/2026 »
}

export function parseRehabRows(rows: unknown[][], today: string): RehabPlan {
  const h = rows.findIndex(r => norm(r[0]) === 'etape')
  if (h < 0) throw new Error('Ligne d\'en-tête « Étape | Objectifs | … » introuvable.')
  const col = (name: string) => rows[h].findIndex(c => norm(c).startsWith(name))
  const c = { obj: col('objectif'), kine: col('actions kine'), prepa: col('actions prepa'), status: col('statut'), comment: col('commentaire') }
  if (Object.values(c).some(i => i < 0)) throw new Error('Colonnes attendues : Étape, Objectifs, Actions Kiné, Actions Prépa, Statut, Commentaires.')
  const start = rows.slice(0, h).flat().map(v => toDate(v, true)).find(Boolean) ?? null // « Date de début » de l'en-tête
  const heading = String(rows.slice(0, h).flat().find(v => String(v ?? '').trim()) ?? '').trim()

  type Raw = ImportedStep & { date: string | null; done: boolean; phaseEnd: string | null }
  const steps: Raw[] = []
  let phase: string | null = null, phaseDays: number | null = null, elapsed = 0
  for (const r of rows.slice(h + 1)) {
    const title = String(r[0] ?? '').trim()
    if (!title) continue
    const ph = title.match(/^(phase\s*\d+.*?)\s*[-–]\s*(\d+)\s*jours?\s*$/i)
    if (ph || (/^phase\s*\d+/i.test(title) && r.slice(1).every(v => !String(v ?? '').trim()))) {
      if (phaseDays) elapsed += phaseDays
      phase = (ph?.[1] ?? title).trim(); phaseDays = ph ? Number(ph[2]) : null
      if (phaseDays != null && phaseDays > 365) throw new Error(`Durée de phase invalide (${phaseDays} jours) : « ${title} ».`)
      continue
    }
    const status = norm(r[c.status]), date = toDate(r[c.comment])
    steps.push({
      title, phase, phase_days: phaseDays, planned_days: 7, validated_on: null,
      objectives: text(r[c.obj]), kine_actions: text(r[c.kine]), prepa_actions: text(r[c.prepa]),
      comment: date ? null : text(r[c.comment]), is_test: /\b(test|radio|bilan|controle)\b/i.test(norm(title)) && title === title.toUpperCase(),
      in_progress: status.startsWith('en cours'), date, done: status.startsWith('termine'),
      phaseEnd: start && phaseDays ? addDays(start, elapsed + phaseDays) : null,
    })
  }
  if (!steps.length) throw new Error('Aucune étape trouvée sous la ligne d\'en-tête.')

  return {
    heading,
    steps: steps.map((s, i) => {
      const same = steps.filter(x => x.phase === s.phase)
      const k = same.indexOf(s)
      // Jours de la phase répartis sur ses étapes (le reste sur les dernières) ; sans durée de phase, 7 jours
      const planned = s.phase_days ? Math.floor(s.phase_days / same.length) + (k >= same.length - (s.phase_days % same.length) ? 1 : 0) : 7
      // Étape terminée : sa date, sinon celle du test qui clôt sa phase, sinon la fin théorique de la phase
      const closing = steps.slice(i).find(x => x.phase === s.phase && x.date)?.date ?? s.phaseEnd
      // Sans date passée fiable, l'étape reste « en cours » plutôt que validée à une date inventée
      const when = s.date ?? closing
      const validated = s.done && when && when <= today ? when : null
      const comment = !s.done && s.date ? [`Prévu le ${s.date.split('-').reverse().join('/')}`, s.comment].filter(Boolean).join(' · ') : s.comment
      return { title: s.title, phase: s.phase, phase_days: s.phase_days, planned_days: planned, validated_on: validated,
        objectives: s.objectives, kine_actions: s.kine_actions, prepa_actions: s.prepa_actions, comment, is_test: s.is_test, in_progress: s.in_progress || (s.done && !validated) }
    }),
  }
}

export function readRehabPlan(data: ArrayBuffer, today: string): RehabPlan {
  const wb = XLSX.read(data, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return parseRehabRows(XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }), today)
}

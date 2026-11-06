import { useState } from 'react'
import { Check } from 'lucide-react'
import { addDays } from '../../lib/week'
import { byPhase, planProgress, type Step } from './medical'

// Plan de retour en frise verticale, partagée staff / joueur : étapes passées (vert, cochées), en cours (or, ouverte,
// jours écoulés sur prévus), à venir (cercle vide, grisées). Regroupées par phase quand le plan en a.
// audience « joueur » : jamais d'actions kiné ni de commentaire (la RPC ne les renvoie pas ; on ne les lit pas non plus).
type Progress = ReturnType<typeof planProgress>
type Audience = 'staff' | 'joueur'

const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

// Jours passés dans l'étape en cours : depuis la validation de l'étape validée juste avant (comme planProgress), sinon la blessure
function stepElapsed(p: Progress, occurredOn: string, today: string) {
  if (!p.current) return 0
  const started = p.ordered.filter(s => s.validated_on && s.position < p.current!.position).at(-1)?.validated_on ?? occurredOn
  return Math.max(0, days(started, today))
}

function details(s: Step, audience: Audience): [string, string][] {
  const rows: [string, string | null | undefined][] = [
    ['Objectifs', s.objectives], [audience === 'joueur' ? 'Au programme' : 'Actions prépa', s.prepa_actions],
    ...(audience === 'staff' ? [['Actions kiné', s.kine_actions], ['Commentaire', s.comment]] as [string, string | null | undefined][] : []),
    [audience === 'joueur' ? 'Pour passer à la suite' : 'Critères de validation', s.criteria],
  ]
  return rows.filter((r): r is [string, string] => !!r[1])
}

// Barre des jours de l'étape en cours ; au-delà du prévu, la barre reste pleine et le texte le dit
export function StepDays({ p, occurredOn, today }: { p: Progress; occurredOn: string; today: string }) {
  const elapsed = stepElapsed(p, occurredOn, today), planned = p.current?.planned_days ?? 0
  const over = planned > 0 && elapsed > planned
  return (
    <span className="flex items-center gap-2 text-xs text-ink/70">
      <span aria-hidden="true" className="h-1.5 flex-1 rounded-full bg-field">
        <span className="block h-full rounded-full bg-gold" style={{ width: `${planned ? Math.min(100, Math.max(4, (100 * elapsed) / planned)) : 100}%` }} />
      </span>
      <span className="shrink-0 tabular-nums">{planned ? `jour ${elapsed + 1} sur ${planned}${over ? ' (prolongée)' : ''}` : 'étape sans durée'}</span>
    </span>
  )
}

export function PlanTimeline({ p, occurredOn, today, audience }: { p: Progress; occurredOn: string; today: string; audience: Audience }) {
  const [open, setOpen] = useState<string | null>(null)
  const currentIndex = p.current ? p.ordered.indexOf(p.current) : p.ordered.length
  // Début estimé de chaque étape à venir : fin théorique de l'étape en cours, puis les durées prévues mises bout à bout
  const startOf = new Map<string, string>()
  if (p.current) {
    let d = addDays(today, Math.max(0, p.current.planned_days - stepElapsed(p, occurredOn, today)))
    for (const s of p.ordered.slice(currentIndex + 1)) { if (!s.validated_on) { startOf.set(s.id, d); d = addDays(d, s.planned_days) } }
  }
  return (
    <ol className="flex flex-col">
      {byPhase(p.ordered).map((g, gi) => {
        const state = g.steps.every(s => s.validated_on) ? 'terminée' : g.steps.some(s => s.id === p.current?.id) ? 'en cours' : 'à venir'
        return (
          <li key={`${g.phase}-${gi}`} className="flex flex-col">
            {g.phase && (
              <p className="mb-2 mt-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <span className={state === 'à venir' ? 'text-ink/45' : 'text-ink/70'}>{g.phase}</span>
                <span className={`rounded-full px-2 py-0.5 normal-case tracking-normal ${state === 'terminée' ? 'bg-ok/15 text-ok' : state === 'en cours' ? 'bg-gold/15 text-gold' : 'bg-field text-ink/50'}`}>
                  {state}{g.days != null ? ` · ${g.days} j` : ''}
                </span>
              </p>
            )}
            <ol className="flex flex-col">
              {g.steps.map(s => {
                const i = p.ordered.indexOf(s)
                const status = s.validated_on ? 'done' : s.id === p.current?.id ? 'current' : 'next'
                const isLast = i === p.ordered.length - 1
                const info = details(s, audience)
                const expanded = status === 'current' || open === s.id
                return (
                  <li key={s.id} className="relative flex gap-3 pb-4 last:pb-1">
                    {/* rail : vert jusqu'à l'étape en cours, gris ensuite */}
                    {!isLast && <span aria-hidden="true" className={`absolute bottom-0 left-[11px] top-7 w-0.5 rounded ${i < currentIndex ? 'bg-ok/60' : 'bg-line'}`} />}
                    <span aria-hidden="true" className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      status === 'done' ? 'bg-ok text-app' : status === 'current' ? 'bg-gold/20 ring-2 ring-gold' : 'border-2 border-line bg-app'}`}>
                      {status === 'done' ? <Check size={14} strokeWidth={3} /> : status === 'current' ? <span className="h-2 w-2 rounded-full bg-gold" /> : null}
                    </span>
                    <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${status === 'current' ? 'rounded-xl bg-gold/10 px-3 py-2.5 ring-1 ring-gold/40' : ''}`}>
                      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="sr-only">{status === 'done' ? 'Étape passée : ' : status === 'current' ? 'Étape en cours : ' : 'Étape à venir : '}</span>
                        <span className={`font-semibold ${status === 'next' ? 'text-ink/65' : ''}`}>{s.title}</span>
                        {s.is_test && <span className="rounded-full bg-field px-2 py-0.5 text-xs text-ink/70">test</span>}
                        <span className="ml-auto text-xs text-ink/55">
                          {status === 'done' ? `validée le ${shortDate(s.validated_on!)}` : status === 'current' ? 'en cours'
                            : [s.planned_days ? `${s.planned_days} j` : null, startOf.has(s.id) ? `vers le ${shortDate(startOf.get(s.id)!)}` : null].filter(Boolean).join(' · ')}
                        </span>
                      </p>
                      {status === 'current' && <StepDays p={p} occurredOn={occurredOn} today={today} />}
                      {info.length > 0 && (expanded ? (
                        <dl className="flex flex-col gap-1 text-sm">
                          {info.map(([k, v]) => (
                            <div key={k}><dt className="text-xs font-semibold text-ink/55">{k}</dt><dd className="text-ink/85">{v}</dd></div>
                          ))}
                          {status !== 'current' && <button type="button" onClick={() => setOpen(null)} className="self-start text-xs text-ink/50 hover:underline">Masquer</button>}
                        </dl>
                      ) : (
                        <button type="button" onClick={() => setOpen(s.id)} className="self-start text-xs text-ink/50 hover:underline">Détails</button>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ol>
          </li>
        )
      })}
      {!p.current && <li className="text-sm font-semibold text-ok">Toutes les étapes sont validées{audience === 'joueur' ? ' : le staff va te remettre dans le groupe.' : '.'}</li>}
    </ol>
  )
}

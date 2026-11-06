import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Kpi } from '../../components/ui/Kpi'
import { formatDay } from '../../lib/week'
import { fullName, type Player } from './load'
import { ACTIVITIES, LOCATIONS, MECHANISMS, ONSETS, TISSUES, epidemiology, planProgress, type InjuryRecord, type Step } from './medical'
import { useDeleteStep, useSaveInjury, useSaveStep } from './useStaff'

// Blocs de l'onglet Médical (étape 13) : fiche blessure, plan de retour, rapport d'épidémiologie
const field = 'rounded-lg bg-field border border-line px-2 py-1.5 text-sm'
type Injury = InjuryRecord & { diagnosis: string | null; notes: string | null }

function Choice({ label, value, options, onChange }: { label: string; value: string | null; options: Record<string, string>; onChange: (v: string | null) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink/70">{label}
      <select value={value ?? ''} onChange={e => onChange(e.target.value || null)} className={field}>
        <option value="">— à renseigner</option>
        {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </label>
  )
}

// Fiche blessure : classement World Rugby / CIO (pour l'épidémiologie), diagnostic et notes (staff seulement)
export function InjuryForm({ injury }: { injury: Injury }) {
  const save = useSaveInjury()
  const [diagnosis, setDiagnosis] = useState(injury.diagnosis ?? '')
  const [notes, setNotes] = useState(injury.notes ?? '')
  const set = (fields: Parameters<typeof save.mutate>[0]) => save.mutate(fields)
  const a = injury.alerts
  const items = Object.entries(a.items_at_1 ?? {})
  return (
    <section aria-label="Fiche blessure" className="flex flex-col gap-2">
      <h3 className="font-display text-lg font-semibold">Fiche blessure <span className="font-sans text-sm font-normal text-ink/60">survenue le {formatDay(injury.occurred_on)}</span></h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <Choice label="Localisation" value={injury.location} options={LOCATIONS} onChange={v => set({ id: injury.id, location: v })} />
        <Choice label="Tissu" value={injury.tissue} options={TISSUES} onChange={v => set({ id: injury.id, tissue: v })} />
        <Choice label="Mécanisme" value={injury.mechanism} options={MECHANISMS} onChange={v => set({ id: injury.id, mechanism: v })} />
        <Choice label="Survenue en" value={injury.activity} options={ACTIVITIES} onChange={v => set({ id: injury.id, activity: v })} />
        <Choice label="Apparition" value={injury.onset} options={ONSETS} onChange={v => set({ id: injury.id, onset: v })} />
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={injury.recurrence} onChange={e => set({ id: injury.id, recurrence: e.target.checked })} />Récidive
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs text-ink/70">Diagnostic (staff seulement)
        <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} onBlur={() => diagnosis !== (injury.diagnosis ?? '') && set({ id: injury.id, diagnosis: diagnosis.trim() || null })} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink/70">Notes (staff seulement)
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => notes !== (injury.notes ?? '') && set({ id: injury.id, notes: notes.trim() || null })} className={field} />
      </label>
      {save.isError && <p role="alert" className="text-xs text-rnr">Non enregistré, réessaie.</p>}
      <p className="text-sm text-ink/70">
        <span className="font-semibold text-ink">Avant la blessure (28 jours) : </span>
        {a.alert_days ?? 0} jour{(a.alert_days ?? 0) > 1 ? 's' : ''} d'état de forme en alerte sur {a.wellness_days ?? 0} rempli{(a.wellness_days ?? 0) > 1 ? 's' : ''}
        {items.length > 0 && <> ({items.map(([k, n]) => `${k} à 1 : ${n} fois`).join(', ')})</>}
        {' · '}charge 7 jours {a.acute ?? 0} UA pour {a.chronic ?? 0} UA par semaine en moyenne sur 28 jours
        {a.chronic ? ` (ratio ${((a.acute ?? 0) / a.chronic).toLocaleString('fr-FR', { maximumFractionDigits: 2 })})` : ''}.
      </p>
    </section>
  )
}

// Plan de retour : étapes ordonnées avec durée théorique et critères ; le staff valide, modifie, ajoute ou retire
export function ReturnPlan({ injury, steps, today }: { injury: Injury; steps: Step[]; today: string }) {
  const save = useSaveStep()
  const remove = useDeleteStep()
  const p = planProgress(steps, injury.occurred_on, today)
  const base = { injury_id: injury.id, player_id: injury.player_id }
  return (
    <section aria-label="Plan de retour" className="flex flex-col gap-2">
      <h3 className="font-display text-lg font-semibold">Plan de retour</h3>
      <p className="text-sm">
        {p.current ? <>Étape <strong>{p.done + 1}/{p.total}</strong> : {p.current.title} · <strong>{p.remainingDays} jour{p.remainingDays > 1 ? 's' : ''}</strong> théoriques restants
          {p.returnDate && <> · retour estimé le <strong>{formatDay(p.returnDate)}</strong></>}</> : <span className="text-ok">Toutes les étapes sont validées : retour possible (repasser le joueur « apte » dans sa fiche).</span>}
      </p>
      <ol className="flex flex-col">
        {p.ordered.map(s => <StepRow key={`${s.id}-${s.validated_on}-${s.planned_days}`} step={s} current={p.current?.id === s.id} today={today}
          onSave={v => save.mutate({ ...base, ...s, ...v })} onDelete={() => remove.mutate(s.id)} />)}
      </ol>
      <div>
        <Button size="sm" variant="ghost" disabled={save.isPending}
          onClick={() => save.mutate({ ...base, position: (p.ordered.at(-1)?.position ?? 0) + 1, title: 'Nouvelle étape', criteria: null, planned_days: 7 })}>
          Ajouter une étape
        </Button>
      </div>
      {(save.isError || remove.isError) && <p role="alert" className="text-xs text-rnr">Modification impossible, réessaie.</p>}
    </section>
  )
}

function StepRow({ step, current, today, onSave, onDelete }: {
  step: Step; current: boolean; today: string; onSave: (v: Partial<Step>) => void; onDelete: () => void
}) {
  const [title, setTitle] = useState(step.title)
  const [criteria, setCriteria] = useState(step.criteria ?? '')
  const [daysText, setDaysText] = useState(String(step.planned_days))
  const d = Number(daysText)
  return (
    <li className={`flex flex-wrap items-start gap-2 border-t border-line py-2 first:border-0 ${current ? 'rounded-lg bg-gold/10 px-2' : ''}`}>
      <span className="w-6 pt-1.5 text-center font-semibold">{step.validated_on ? <span className="text-ok">✓</span> : step.position}</span>
      <div className="flex min-w-60 flex-1 flex-col gap-1">
        <input value={title} aria-label="Étape" onChange={e => setTitle(e.target.value)} onBlur={() => title.trim() && title !== step.title && onSave({ title: title.trim() })}
          className={`${field} font-semibold`} />
        <input value={criteria} aria-label="Critères pour valider l'étape" placeholder="Critères pour valider l'étape" onChange={e => setCriteria(e.target.value)}
          onBlur={() => criteria !== (step.criteria ?? '') && onSave({ criteria: criteria.trim() || null })} className={field} />
      </div>
      <label className="flex items-center gap-1 pt-1.5 text-sm">
        <input type="number" min={0} max={365} value={daysText} aria-label="Durée théorique (jours)" onChange={e => setDaysText(e.target.value)}
          onBlur={() => Number.isInteger(d) && d >= 0 && d <= 365 && d !== step.planned_days && onSave({ planned_days: d })} className={`${field} w-16`} /> j
      </label>
      <span className="flex items-center gap-2 pt-1">
        {step.validated_on
          ? <><Badge tone="ok">validée le {formatDay(step.validated_on)}</Badge><button type="button" className="text-xs text-ink/60 underline" onClick={() => onSave({ validated_on: null })}>Annuler</button></>
          : <Button size="sm" onClick={() => onSave({ validated_on: today })}>Valider</Button>}
        {!step.validated_on && <button type="button" className="text-xs text-ink/60 underline" onClick={onDelete} aria-label={`Retirer l'étape ${step.title}`}>Retirer</button>}
      </span>
    </li>
  )
}

// Rapport d'épidémiologie du groupe sur une période (saison ou cycle)
export function EpidemiologyCard({ injuries, players, exposure, from, to, today, period }: {
  injuries: InjuryRecord[]; players: Player[]; exposure: { trainingMin: number; matchMin: number }; from: string; to: string; today: string; period: string
}) {
  const e = epidemiology(injuries, exposure, from, to, today)
  const label = (map: Record<string, string>, k: string) => map[k] ?? (k === 'non_renseigne' ? 'Non renseigné' : k)
  const list = (title: string, rows: [string, number][], map: Record<string, string>) => (
    <div className="min-w-44">
      <p className="text-xs text-ink/60">{title}</p>
      <ul className="text-sm">{rows.length ? rows.map(([k, n]) => <li key={k} className="flex justify-between gap-3"><span>{label(map, k)}</span><span className="tabular-nums">{n}</span></li>) : <li className="text-ink/50">—</li>}</ul>
    </div>
  )
  const name = (id: string) => { const p = players.find(x => x.id === id); return p ? fullName(p) : '—' }
  return (
    <Card title={`Épidémiologie · ${period}`}
      help="Blessures survenues sur la période. Incidence : blessures pour 1000 h d'exposition (minutes déclarées à l'entraînement, minutes de match saisies par le coach). Poids : jours perdus pour 1000 h. Classement World Rugby / CIO, à compléter dans chaque fiche.">
      <div className="flex flex-wrap gap-3">
        <Kpi label="Blessures" value={String(e.count)} hint={`${e.open} en cours · ${e.recurrences} récidive${e.recurrences > 1 ? 's' : ''}`} />
        <Kpi label="Incidence / 1000 h" value={e.incidence === null ? '—' : e.incidence.toLocaleString('fr-FR')} hint={`${e.hours} h d'exposition`} />
        <Kpi label="Match / entraînement" value={`${e.matchIncidence?.toLocaleString('fr-FR') ?? '—'} / ${e.trainingIncidence?.toLocaleString('fr-FR') ?? '—'}`} hint="pour 1000 h" />
        <Kpi label="Jours perdus" value={String(e.daysLost)} hint={e.burden === null ? undefined : `poids ${e.burden.toLocaleString('fr-FR')} j / 1000 h`} />
        <Kpi label="Alertes avant blessure" value={`${e.withAlerts} / ${e.count}`} hint={e.items.slice(0, 2).map(([k, n]) => `${k} à 1 : ${n}`).join(' · ') || 'blessures précédées d\'une alerte wellness'} />
      </div>
      {e.count > 0 && (
        <>
          <div className="flex flex-wrap gap-6">
            {list('Localisation', e.byLocation, LOCATIONS)}{list('Mécanisme', e.byMechanism, MECHANISMS)}
            {list('Survenue en', e.byActivity, ACTIVITIES)}{list('Tissu', e.byTissue, TISSUES)}
          </div>
          <table className="text-sm">
            <thead className="text-left text-xs text-ink/55"><tr><th className="py-1 pr-4 font-normal">Joueur</th><th className="pr-4 font-normal">Survenue</th><th className="pr-4 font-normal">Localisation</th><th className="pr-4 font-normal">En</th><th className="font-normal">Jours</th></tr></thead>
            <tbody>
              {injuries.filter(i => i.occurred_on >= from && i.occurred_on <= to).map(i => (
                <tr key={i.id} className="border-t border-line">
                  <td className="py-1 pr-4 font-semibold">{name(i.player_id)}</td><td className="pr-4">{formatDay(i.occurred_on)}</td>
                  <td className="pr-4">{i.location ? label(LOCATIONS, i.location) : '—'}</td><td className="pr-4">{i.activity ? label(ACTIVITIES, i.activity) : '—'}</td>
                  <td className="tabular-nums">{Math.round((Date.parse(`${i.ended_on ?? today}T00:00:00Z`) - Date.parse(`${i.occurred_on}T00:00:00Z`)) / 86_400_000)}{!i.ended_on && ' (en cours)'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  )
}

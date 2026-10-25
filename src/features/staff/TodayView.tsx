import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Kpi } from '../../components/ui/Kpi'
import { Loading } from '../../components/ui/Loading'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { addDays, parisDate } from '../../lib/week'
import { fatiguePercent, postureOf } from '../wellness/fatigue'
import { WELLNESS_ITEMS } from '../wellness/items'
import { fullName, itemValue, latecomers, reminderMessage, wellnessAlerts } from './load'
import { useAllLogs, useAllPlan, useAllWellness, useRoster } from './useStaff'

// Seules les réponses moyennes ou mauvaises ressortent : l'œil va droit aux problèmes
const itemLook = (v: number) => (v >= 4 ? 'text-ink/45' : v === 3 ? 'text-gold font-semibold' : 'text-rnr font-bold')
const BAR = ['bg-ok', 'bg-gold', 'bg-rnr'] // fatigue faible, moyenne, à surveiller
const SHORT: Record<string, string> = { soreness_upper: 'Courb. haut', soreness_lower: 'Courb. bas' }
type Filter = 'tous' | 'alertes' | 'non-remplis'

export function TodayView() {
  const today = parisDate()
  const yesterday = addDays(today, -1)
  const roster = useRoster()
  const wellness = useAllWellness(today, today)
  const logs = useAllLogs(yesterday, today)
  const plan = useAllPlan(yesterday, yesterday)
  const [filter, setFilter] = useState<Filter>('tous')

  if (roster.isPending || wellness.isPending || logs.isPending || plan.isPending) return <Loading />
  if (roster.isError || wellness.isError || logs.isError || plan.isError) return <p>Impossible de charger les données du jour.</p>

  const byPlayer = new Map(wellness.data.map(w => [w.player_id, w]))
  const rows = roster.data.map(p => {
    const w = byPlayer.get(p.id)
    return { player: p, w, alerts: w ? wellnessAlerts(w) : [] }
  })
  // Alertes d'abord, puis forme non remplie, puis les autres par fatigue décroissante
  const rank = (r: (typeof rows)[number]) => (r.alerts.length ? 0 : !r.w ? 1 : 2)
  rows.sort((a, b) => rank(a) - rank(b) || (a.w?.score ?? 99) - (b.w?.score ?? 99))
  const filled = rows.filter(r => r.w).length
  const alerted = rows.filter(r => r.alerts.length)
  const late = latecomers(roster.data, wellness.data, plan.data, logs.data, today)
  const shown = rows.filter(r => filter === 'tous' || (filter === 'alertes' ? r.alerts.length > 0 : !r.w))
  const mean = groupFatigue(rows)

  return (
    <>
      {/* La lecture du jour en une phrase : ce qu'il faut savoir avant de regarder le détail */}
      <section className="flex flex-col gap-4">
        <p className="max-w-4xl text-lg leading-snug">
          <strong>{filled} joueurs sur {rows.length}</strong> ont rempli leur état de forme.{' '}
          {alerted.length === 0 ? 'Aucune alerte.' : <>
            <strong className="text-rnr">{alerted.length} alerte{alerted.length > 1 ? 's' : ''}</strong> :{' '}
            {alerted.map((r, i) => <span key={r.player.id}>{i > 0 && ', '}<Link to={`/staff/joueur/${r.player.id}`} className="font-semibold underline-offset-4 hover:underline">{fullName(r.player)}</Link> ({r.alerts.join(', ').toLowerCase()})</span>)}.
          </>}
          {mean !== null && <> Fatigue moyenne du groupe : <strong>{mean} %</strong>.</>}
        </p>
        <div className="flex flex-wrap gap-3">
          <Kpi label="États de forme remplis" value={`${filled} / ${rows.length}`} />
          <Kpi label="Alertes" value={String(alerted.length)} tone={alerted.length ? 'bad' : 'ok'} />
          <Kpi label="À relancer" value={String(late.length)} tone={late.length ? 'warn' : 'ok'} />
          <Kpi label="Blessés" value={String(roster.data.filter(p => p.injured).length)} />
        </div>
      </section>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card title="État de forme du jour"
          help="Chaque question de 1 (mauvais) à 5 (bon) : 3 en jaune, 1 et 2 en rouge. Alerte : score sous 16/30 ou une réponse à 1. Un nom ouvre la fiche du joueur."
          aside={(
            <ViewSelect label="Afficher" value={filter} onChange={setFilter}>
              <option value="tous">Tous ({rows.length})</option>
              <option value="alertes">Alertes ({alerted.length})</option>
              <option value="non-remplis">Non remplis ({rows.length - filled})</option>
            </ViewSelect>
          )}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink/55">
                <tr>
                  <th className="py-2 pr-3 font-normal">Joueur</th>
                  <th className="pr-3 font-normal">Fatigue estimée</th>
                  <th className="pr-3 font-normal">Score</th>
                  {WELLNESS_ITEMS.map(i => <th key={i.key} className="px-1 text-center font-normal">{SHORT[i.key] ?? i.label}</th>)}
                  <th className="pl-2 font-normal">Alerte</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ player, w, alerts }) => {
                  const pct = w?.score != null ? fatiguePercent(w.score) : null
                  return (
                    <tr key={player.id} className={`border-t border-line ${alerts.length ? 'bg-rnr/[0.07]' : ''}`}>
                      <td className="py-1.5 pr-3">
                        <Link to={`/staff/joueur/${player.id}`} className="font-semibold underline-offset-4 hover:underline">{fullName(player)}</Link>
                        <span className="ml-2 text-xs text-ink/50">{player.position}</span>
                        {player.injured && <span className="ml-2"><Badge tone="warn">blessé</Badge></span>}
                      </td>
                      <td className="pr-3">
                        {pct === null ? <span className="text-ink/50">non rempli</span> : (
                          <span className="flex items-center gap-2" title="Estimation d'après les 6 réponses : 0 % = en pleine forme, 100 % = épuisé">
                            <span className="h-1.5 w-16 rounded-full bg-field" aria-hidden="true">
                              <span className={`block h-full rounded-full ${BAR[postureOf(pct)]}`} style={{ width: `${Math.max(pct, 4)}%` }} />
                            </span>
                            <span className="tabular-nums">{pct} %</span>
                          </span>
                        )}
                      </td>
                      <td className="pr-3 tabular-nums">{w?.score != null ? <><span className="font-semibold">{w.score}</span><span className="text-ink/50">/30</span></> : '—'}</td>
                      {WELLNESS_ITEMS.map(i => {
                        const v = w ? itemValue(w, i.key) : null
                        return <td key={i.key} className={`px-1 text-center tabular-nums ${v !== null ? itemLook(v) : 'text-ink/30'}`}>{v ?? '·'}</td>
                      })}
                      <td className="pl-2 text-xs font-semibold text-rnr">{alerts.join(' · ')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {shown.length === 0 && <p className="py-3 text-sm text-ink/60">Personne dans cette catégorie.</p>}
          </div>
        </Card>

        <Card title={`À relancer (${late.length})`}
          help="Ont oublié une saisie hier ou aujourd'hui. Copiez le message, puis envoyez-le au joueur.">
          {late.length === 0 && <p className="text-sm text-ok">Tout le monde est à jour.</p>}
          <ul className="flex flex-col">
            {late.map(({ player, missing }) => <Reminder key={player.id} name={fullName(player)} missing={missing} message={reminderMessage(player, missing)} />)}
          </ul>
        </Card>
      </div>
    </>
  )
}

// Moyenne de fatigue estimée du groupe, pour situer chaque joueur
function groupFatigue(rows: { w?: { score: number | null } }[]) {
  const scores = rows.flatMap(r => (r.w?.score != null ? [r.w.score] : []))
  return scores.length ? Math.round(scores.reduce((s, v) => s + fatiguePercent(v), 0) / scores.length) : null
}

function Reminder({ name, missing, message }: { name: string; missing: string[]; message: string }) {
  const [copied, setCopied] = useState<boolean | null>(null)
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setCopied(true) } catch { setCopied(false) }
    setTimeout(() => setCopied(null), 2500)
  }
  return (
    <li className="flex items-center justify-between gap-2 border-t border-line py-2">
      <span className="min-w-0">
        <span className="block truncate font-semibold">{name}</span>
        <span className="block text-xs text-ink/60">{missing.join(', ')}</span>
      </span>
      <button type="button" onClick={copy} aria-label={`Copier le message pour ${name}`}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm ${copied ? 'border-ok text-ok' : 'border-line hover:border-ink/40'}`}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {copied === null ? 'Copier' : copied ? 'Copié' : 'Impossible'}
      </button>
    </li>
  )
}

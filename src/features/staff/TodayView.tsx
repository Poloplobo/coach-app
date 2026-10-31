import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { BRAND } from '../../lib/brand'
import { addDays, formatDay, parisDate } from '../../lib/week'
import { useProfile, useUserId } from '../auth/useAuth'
import { StatCard } from './StatCard'
import { fatiguePercent, postureOf } from '../wellness/fatigue'
import { WELLNESS_ITEMS } from '../wellness/items'
import { fullName, itemValue, latecomers, reminderMessage, wellnessAlerts } from './load'
import { useAllLogs, useAllPlan, useAllWellness, useRoster } from './useStaff'

// Seules les réponses moyennes ou mauvaises ressortent : l'œil va droit aux problèmes
const itemLook = (v: number) => (v >= 4 ? 'text-ink/45' : v === 3 ? 'text-gold font-semibold' : 'text-rnr font-bold')
const BAR = ['bg-ok', 'bg-gold', 'bg-rnr'] // fatigue faible, moyenne, à surveiller
const SHORT: Record<string, string> = { soreness_upper: 'Courb. haut', soreness_lower: 'Courb. bas' }
type Filter = 'tous' | 'alertes' | 'non-remplis' | 'bien' | 'moyen' | 'surveiller'
// Forme du groupe : même découpage que la jauge de fatigue (postureOf) ; un clic sur une part filtre le tableau
const LEVELS = [
  { id: 'bien', label: 'En forme', color: BRAND.ok },
  { id: 'moyen', label: 'Fatigue moyenne', color: BRAND.gold },
  { id: 'surveiller', label: 'À surveiller', color: BRAND.rnr },
] as const
const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })

export function TodayView() {
  const today = parisDate()
  const yesterday = addDays(today, -1)
  const roster = useRoster()
  const me = useProfile(useUserId())
  const wellness = useAllWellness(addDays(today, -6), today) // 7 jours : tendances des cartes
  const logs = useAllLogs(yesterday, today)
  const plan = useAllPlan(yesterday, yesterday)
  const [filter, setFilter] = useState<Filter>('tous')

  if (roster.isPending || wellness.isPending || logs.isPending || plan.isPending) return <Loading />
  if (roster.isError || wellness.isError || logs.isError || plan.isError) return <p>Impossible de charger les données du jour.</p>

  const todayW = wellness.data.filter(w => w.entry_date === today)
  const byPlayer = new Map(todayW.map(w => [w.player_id, w]))
  const rows = roster.data.map(p => {
    const w = byPlayer.get(p.id)
    return { player: p, w, alerts: w ? wellnessAlerts(w) : [] }
  })
  // Alertes d'abord, puis forme non remplie, puis les autres par fatigue décroissante
  const rank = (r: (typeof rows)[number]) => (r.alerts.length ? 0 : !r.w ? 1 : 2)
  rows.sort((a, b) => rank(a) - rank(b) || (a.w?.score ?? 99) - (b.w?.score ?? 99))
  const filled = rows.filter(r => r.w).length
  const alerted = rows.filter(r => r.alerts.length)
  const late = latecomers(roster.data, todayW, plan.data, logs.data, today)
  const level = (r: (typeof rows)[number]) => (r.w?.score != null ? LEVELS[postureOf(fatiguePercent(r.w.score))].id : null)
  const shown = rows.filter(r => filter === 'tous' || (filter === 'alertes' ? r.alerts.length > 0 : filter === 'non-remplis' ? !r.w : level(r) === filter))
  const mean = groupFatigue(rows)
  const donut = [...LEVELS.map(l => ({ ...l, count: rows.filter(r => level(r) === l.id).length })),
    { id: 'non-remplis' as const, label: 'Non rempli', color: BRAND.muted, count: rows.length - filled }].filter(x => x.count > 0)

  // Tendances des 7 derniers jours (aujourd'hui en dernier) : remplis, alertes, fatigue moyenne
  const trend = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map(d => {
    const ws = wellness.data.filter(w => w.entry_date === d)
    const pcts = ws.flatMap(w => (w.score != null ? [fatiguePercent(w.score)] : []))
    return { day: shortDay(d), filled: ws.length, alerts: ws.filter(w => wellnessAlerts(w).length).length,
      fatigue: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null }
  })
  const [prev, cur] = [trend[5], trend[6]]
  const series = (k: 'filled' | 'alerts' | 'fatigue') => trend.map(t => ({ day: t.day, value: t[k] }))

  return (
    <>
      {/* Bonjour, puis la lecture du jour en une phrase : ce qu'il faut savoir avant de regarder le détail */}
      <header className="rise flex flex-col gap-1">
        <p className="text-sm text-ink/55 first-letter:uppercase">{formatDay(today)}</p>
        <h1 className="font-display text-3xl font-bold leading-tight">Bonjour {me.data?.first_name}</h1>
        <p className="max-w-4xl text-base leading-snug text-ink/80">
          <strong className="text-ink">{filled} joueurs sur {rows.length}</strong> ont rempli leur état de forme.{' '}
          {alerted.length === 0 ? 'Aucune alerte.' : <>
            <strong className="text-rnr">{alerted.length} alerte{alerted.length > 1 ? 's' : ''}</strong> :{' '}
            {alerted.map((r, i) => <span key={r.player.id}>{i > 0 && ', '}<Link to={`/staff/joueur/${r.player.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">{fullName(r.player)}</Link> ({r.alerts.join(', ').toLowerCase()})</span>)}.
          </>}
          {roster.data.some(p => p.injured) && <> {roster.data.filter(p => p.injured).length} blessé{roster.data.filter(p => p.injured).length > 1 ? 's' : ''}.</>}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard order={1} label="États de forme remplis" value={filled} suffix={` / ${rows.length}`} delta={cur.filled - prev.filled} better="up" trend={series('filled')} color={BRAND.ok} />
        <StatCard order={2} label="Alertes" value={alerted.length} delta={cur.alerts - prev.alerts} better="down" trend={series('alerts')} color={BRAND.rnr} />
        <StatCard order={3} label="Fatigue moyenne" value={mean ?? 0} suffix=" %" delta={cur.fatigue !== null && prev.fatigue !== null ? cur.fatigue - prev.fatigue : null} better="down" trend={series('fatigue')} color={BRAND.gold} />
        <StatCard order={4} label="À relancer" value={late.length} color={BRAND.muted} hint="Oubli d'une saisie hier ou aujourd'hui (liste à droite)." />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rise min-w-0" style={{ animationDelay: '320ms' }}>
        <Card boxed title="État de forme du jour"
          help="Chaque question de 1 (mauvais) à 5 (bon) : 3 en jaune, 1 et 2 en rouge. Alerte : score sous 16/30 ou une réponse à 1. Un nom ouvre la fiche du joueur."
          aside={(
            <ViewSelect label="Afficher" value={filter} onChange={setFilter}>
              <option value="tous">Tous ({rows.length})</option>
              <option value="alertes">Alertes ({alerted.length})</option>
              <option value="non-remplis">Non remplis ({rows.length - filled})</option>
              {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label} ({rows.filter(r => level(r) === l.id).length})</option>)}
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
                      <td className="whitespace-nowrap py-1.5 pr-3">
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
                            <span className="whitespace-nowrap tabular-nums">{pct} %</span>
                          </span>
                        )}
                      </td>
                      <td className="pr-3 tabular-nums">{w?.score != null ? <><span className="font-semibold">{w.score}</span><span className="text-ink/50">/30</span></> : '—'}</td>
                      {WELLNESS_ITEMS.map(i => {
                        const v = w ? itemValue(w, i.key) : null
                        return <td key={i.key} className={`px-1 text-center tabular-nums ${v !== null ? itemLook(v) : 'text-ink/30'}`}>{v ?? '·'}</td>
                      })}
                      <td className="pl-2 text-xs font-semibold text-rnr" title={alerts.join(' · ')}><span className="block max-w-40 truncate">{alerts.length ? (alerts.length > 1 ? `${alerts.length} alertes` : alerts[0]) : ''}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {shown.length === 0 && <p className="py-3 text-sm text-ink/60">Personne dans cette catégorie.</p>}
          </div>
        </Card>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rise" style={{ animationDelay: '400ms' }}>
            <Card boxed title="Forme du groupe" help="Fatigue estimée de chaque joueur aujourd'hui. Cliquez une part pour filtrer le tableau.">
              <div className="relative h-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={donut} dataKey="count" nameKey="label" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none"
                      onClick={(_, i) => setFilter(donut[i].id)} className="cursor-pointer" animationDuration={900}>
                      {donut.map(x => <Cell key={x.id} fill={x.color} opacity={filter === 'tous' || filter === x.id ? 1 : 0.35} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} joueur${Number(v) > 1 ? 's' : ''}`, String(n)]}
                      contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: 'rgb(var(--ink))' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-3xl font-semibold leading-none tabular-nums">{mean ?? '—'}{mean !== null && <span className="text-base text-ink/60"> %</span>}</span>
                  <span className="text-xs text-ink/55">fatigue moyenne</span>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                {donut.map(x => (
                  <li key={x.id}>
                    <button type="button" onClick={() => setFilter(filter === x.id ? 'tous' : x.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left hover:bg-field ${filter === x.id ? 'bg-field font-semibold' : ''}`}>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: x.color }} aria-hidden="true" />
                      <span className="flex-1 truncate">{x.label}</span><span className="tabular-nums text-ink/70">{x.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="rise" style={{ animationDelay: '480ms' }}>
        <Card boxed title={`À relancer (${late.length})`}
          help="Ont oublié une saisie hier ou aujourd'hui. Copiez le message, puis envoyez-le au joueur.">
          {late.length === 0 && <p className="text-sm text-ok">Tout le monde est à jour.</p>}
          <ul className="flex flex-col">
            {late.map(({ player, missing }) => <Reminder key={player.id} name={fullName(player)} missing={missing} message={reminderMessage(player, missing)} />)}
          </ul>
        </Card>
          </div>
        </div>
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
    <li className="flex items-center justify-between gap-2 border-t border-line py-1.5">
      <span className="min-w-0 truncate text-sm" title={missing.join(', ')}>
        <span className="font-semibold">{name}</span> <span className="text-xs text-ink/55">{missing.join(', ')}</span>
      </span>
      <button type="button" onClick={copy} aria-label={`Copier le message pour ${name}`}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm ${copied ? 'border-ok text-ok' : 'border-line hover:border-ink/40'}`}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {copied === null ? 'Copier' : copied ? 'Copié' : 'Impossible'}
      </button>
    </li>
  )
}

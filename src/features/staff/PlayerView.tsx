import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Kpi } from '../../components/ui/Kpi'
import { BRAND } from '../../lib/brand'
import { addDays, parisDate } from '../../lib/week'
import { completion } from '../seances/program'
import { useWeekProgram } from '../seances/useSeance'
import { MyGoals } from '../tests/MyGoals'
import { fatiguePercent } from '../wellness/fatigue'
import { DAY_NAMES, STATUS_TONE, WELLNESS_ALERT_SCORE, acwr, fullName, playerDays, weekMatrix, weekOf, type Log } from './load'
import { AvailabilityPanel, CorrectionPanel } from './PlayerAdmin'
import { useAllLogs, useAllWellness, useIsAdmin, useReference, useRoster } from './useStaff'

const SOURCE = { app: 'joueur', staff: 'staff', import_form: 'formulaire' } as Record<string, string>
const ZONE_TONE = { bas: 'warn', optimal: 'ok', vigilance: 'warn', risque: 'bad' } as const
const ZONE_LABEL = { bas: 'sous-entraînement', optimal: 'zone optimale', vigilance: 'vigilance', risque: 'risque' }

export function PlayerView() {
  const { playerId } = useParams()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const today = parisDate()
  const ref = useReference()
  const roster = useRoster()
  const [code, setCode] = useState<string | null>(null)
  const weeks = ref.data?.weeks ?? []
  const week = weeks.find(w => w.code === code) ?? weekOf(weeks, today)
  const seasonStart = weeks[0]?.start_date ?? addDays(today, -60)
  // Toute la saison d'un coup : courbes, ratio sur 28 jours et semaine choisie viennent des mêmes lignes
  const logs = useAllLogs(addDays(seasonStart, -28), today)
  const wellness = useAllWellness(seasonStart, today)

  if (ref.isPending || roster.isPending || logs.isPending || wellness.isPending) return <p className="text-ink/60">Chargement…</p>
  if (ref.isError || roster.isError || logs.isError || wellness.isError) return <p>Impossible de charger la fiche joueur.</p>

  const player = roster.data.find(p => p.id === playerId) ?? roster.data[0]
  if (!player) return <p>Aucun joueur.</p>
  const wt = week ? ref.data.weekTypes.find(t => t.code === week.week_type_code) ?? null : null
  const inWeek = (l: Log) => !!week && l.session_date >= week.start_date && l.session_date <= addDays(week.start_date, 6)
  const m = week ? weekMatrix(roster.data, logs.data.filter(inWeek), week.start_date, wt) : null
  const row = m?.rows.find(r => r.player.id === player.id)
  const own = logs.data.filter(l => l.player_id === player.id)
  const days = week && m ? playerDays(own.filter(inWeek), ref.data.types, week.start_date, m.dayMeans) : []
  const ratio = acwr(own, today)

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Joueur
          <select value={player.id} onChange={e => navigate(`/staff/joueur/${e.target.value}`)} className="rounded-lg bg-surface border border-line px-3 py-2">
            {roster.data.map(p => <option key={p.id} value={p.id}>{fullName(p)}{p.injured ? ' (blessé)' : ''}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Semaine
          <select value={week?.code ?? ''} onChange={e => setCode(e.target.value)} className="rounded-lg bg-surface border border-line px-3 py-2">
            {weeks.map(w => <option key={w.code} value={w.code}>{w.code} · {w.label}</option>)}
          </select>
        </label>
        <p className="text-sm text-ink/70 pb-2">{player.position ?? '—'}{player.injured && <> · <Badge tone="warn">blessé</Badge></>}</p>
      </div>

      {row && (
        <div className="flex flex-wrap gap-3">
          <Kpi label="Séances déclarées" value={String(row.sessions)} />
          <Kpi label={`sRPE total ${week?.code}`} value={`${row.total} UA`} hint={wt ? `Cible ${wt.target_srpe} UA` : 'Hors calendrier'} />
          <Kpi label="% de la cible" value={`${row.pct} %`} tone={row.status ? STATUS_TONE[row.status] : 'neutral'} hint={row.status ?? undefined} />
          <Kpi label="Vs moyenne du groupe" value={`${row.vsGroupPct > 0 ? '+' : ''}${row.vsGroupPct} %`} />
          <Kpi label="Temps total" value={`${row.minutes} min`} />
          {isAdmin && (
            <Kpi label="Ratio aigu / chronique" value={ratio.ratio === null ? '—' : ratio.ratio.toLocaleString('fr-FR')}
              tone={ratio.zone ? ZONE_TONE[ratio.zone] : 'neutral'}
              hint={ratio.zone ? `${ZONE_LABEL[ratio.zone]} · 7 j ${ratio.acute} / 28 j ${ratio.chronic} UA` : 'Pas assez d\'historique'} />
          )}
        </div>
      )}

      <Card title={`Détail jour par jour${week ? ` — ${week.code}` : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink/60">
              <tr>{['Jour', 'Activités', 'Min', 'Rugby', 'Physique', 'Vidéo / kiné', 'RPE moy.', 'sRPE', 'Moy. groupe', 'Écart'].map(h => <th key={h} className="py-2 pr-3 font-normal">{h}</th>)}</tr>
            </thead>
            <tbody>
              {days.map(d => (
                <tr key={d.date} className="border-t border-line">
                  <td className="py-2 pr-3">{d.day}</td><td className="pr-3">{d.activities || '—'}</td><td className="pr-3">{d.minutes || '—'}</td>
                  <td className="pr-3">{d.rugby || '—'}</td><td className="pr-3">{d.physique || '—'}</td><td className="pr-3">{d.accompagnement || '—'}</td>
                  <td className="pr-3">{d.avgRpe ?? '—'}</td><td className="pr-3 font-semibold">{d.srpe || '—'}</td>
                  <td className="pr-3">{d.groupMean || '—'}</td><td>{d.srpe || d.groupMean ? `${d.gap > 0 ? '+' : ''}${d.gap}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <SeasonCharts own={own} wellness={wellness.data.filter(w => w.player_id === player.id)} weeks={weeks}
          targets={new Map(ref.data.weekTypes.map(t => [t.code, t.target_srpe]))} />
        <Card title="Journal des déclarations de la semaine">
          <ul className="text-sm flex flex-col gap-1 max-h-80 overflow-y-auto">
            {own.filter(inWeek).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((l, i) => (
              <li key={i} className="flex justify-between gap-2 border-t border-line pt-1">
                <span>{DAY_NAMES[(new Date(`${l.session_date}T00:00:00Z`).getUTCDay() + 6) % 7]} · {ref.data.types.find(t => t.id === l.activity_type_id)?.name}</span>
                <span className="text-ink/70">{Number(l.srpe ?? 0)} UA · {new Date(l.created_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })} · {SOURCE[l.source] ?? l.source}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {week && <MuscuWeek playerId={player.id} from={week.start_date} />}
        <MyGoals playerId={player.id} date={today} />
      </div>

      {isAdmin && <AvailabilityPanel player={player} today={today} />}
      <CorrectionPanel player={player} types={ref.data.types} today={today} />
    </>
  )
}

function SeasonCharts({ own, wellness, weeks, targets }: {
  own: Log[]; wellness: { entry_date: string; score: number | null }[]
  weeks: { code: string; start_date: string; week_type_code: string }[]; targets: Map<string, number>
}) {
  const load = weeks.map(w => ({
    week: w.code,
    srpe: own.filter(l => l.session_date >= w.start_date && l.session_date <= addDays(w.start_date, 6)).reduce((s, l) => s + Number(l.srpe ?? 0), 0),
    cible: targets.get(w.week_type_code) ?? null,
  }))
  const form = [...wellness].sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    .flatMap(w => (w.score === null ? [] : [{ date: w.entry_date.slice(5), fatigue: fatiguePercent(w.score) }]))
  return (
    <Card title="Saison">
      <p className="text-xs text-ink/60">Charge par semaine (UA) et cible du type de semaine</p>
      <div className="h-48 text-ink/60">
        <ResponsiveContainer>
          <ComposedChart data={load}>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="week" tick={{ fill: 'currentColor', fontSize: 12 }} />
            <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} width={40} />
            <Tooltip />
            <Bar dataKey="srpe" name="sRPE" fill={BRAND.rnr} radius={[4, 4, 0, 0]} />
            {/* la cible change avec le type de semaine (DEV, COMP, REG) */}
            <Line type="stepAfter" dataKey="cible" name="Cible" stroke={BRAND.gold} strokeDasharray="4 4" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-ink/60">Fatigue estimée (%) d'après l'état de forme</p>
      <div className="h-40 text-ink/60">
        <ResponsiveContainer>
          <LineChart data={form}>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'currentColor', fontSize: 11 }} minTickGap={20} />
            <YAxis domain={[0, 100]} tick={{ fill: 'currentColor', fontSize: 12 }} width={40} />
            <Tooltip />
            <ReferenceLine y={fatiguePercent(WELLNESS_ALERT_SCORE)} stroke={BRAND.rnr} strokeDasharray="4 4" label={{ value: 'alerte', fill: 'currentColor', fontSize: 11 }} />
            <Line dataKey="fatigue" name="Fatigue %" stroke={BRAND.gold} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function MuscuWeek({ playerId, from }: { playerId: string; from: string }) {
  const program = useWeekProgram(playerId, from, addDays(from, 6))
  return (
    <Card title="Musculation de la semaine">
      {!program.data?.length && <p className="text-sm text-ink/70">Pas de séance de musculation cette semaine.</p>}
      <ul className="text-sm flex flex-col gap-1">
        {program.data?.map(s => {
          const c = completion(s.planned_exercises)
          return (
            <li key={s.id} className="flex justify-between border-t border-line pt-1">
              <span className="capitalize">{DAY_NAMES[(new Date(`${s.session_date}T00:00:00Z`).getUTCDay() + 6) % 7]}</span>
              <span>{c.done}/{c.total} exercices faits · <Badge tone={c.pct >= 80 ? 'ok' : c.pct >= 50 ? 'warn' : 'bad'}>{c.pct} %</Badge></span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

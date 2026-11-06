import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Kpi } from '../../components/ui/Kpi'
import { BRAND } from '../../lib/brand'
import { addDays, isoWeekStart, parisDate } from '../../lib/week'
import { pct } from '../../lib/format'
import { completion } from '../seances/program'
import { useWeekProgram } from '../seances/useSeance'
import { MyGoals } from '../tests/MyGoals'
import { fatiguePercent } from '../wellness/fatigue'
import { DAY_NAMES, STATUS_TONE, WELLNESS_ALERT_SCORE, acwr, fullName, loadStatus, playerDays, declarationRate, rpeGap, rpeVsTarget, sessionTarget, weekMatrix, weekOf, type Log, type WeekType } from './load'
import { AvailabilityPanel, CorrectionPanel } from './PlayerAdmin'
import { TestsPanel } from './programming/TestsPanel'
import { useAllLogs, useAllPlan, useAllWellness, useInjuryRecords, useInjurySessions, useIsAdmin, useReference, useRoster, useTargetRpes } from './useStaff'
import { injurySummary } from './injury'
import { Loading } from '../../components/ui/Loading'
import { ViewSelect } from '../../components/ui/ViewSelect'

const SOURCE = { app: 'joueur', staff: 'staff', import_form: 'formulaire', auto: 'validée auto. 23h30' } as Record<string, string>
const ZONE_TONE = { bas: 'warn', optimal: 'ok', vigilance: 'warn', risque: 'bad' } as const
const ZONE_LABEL = { bas: 'sous-entraînement', optimal: 'zone optimale', vigilance: 'vigilance', risque: 'risque' }
const STATUS_TEXT = { ok: 'text-ok', warn: 'text-gold', bad: 'text-rnr', neutral: '' } as const

type Section = 'semaine' | 'saison' | 'muscu' | 'gestion'
const STATUS_WORD = { 'sous-charge': 'en sous-charge', conforme: 'dans la plage visée', surcharge: 'en surcharge' } as const
const n = (v: number) => v.toLocaleString('fr-FR')

export function PlayerView() {
  const { playerId } = useParams()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const today = parisDate()
  const ref = useReference()
  const roster = useRoster()
  const [code, setCode] = useState<string | null>(null)
  const [section, setSection] = useState<Section>('semaine')
  const weeks = ref.data?.weeks ?? []
  const week = weeks.find(w => w.code === code) ?? weekOf(weeks, today)
  const seasonStart = weeks[0]?.start_date ?? addDays(today, -60)
  const selectedId = playerId ?? roster.data?.[0]?.id
  // Saison du seul joueur choisi (courbes, ratio sur 28 jours) ; semaine de tout l'effectif (moyenne du groupe)
  const own = useAllLogs(selectedId ? addDays(seasonStart, -28) : '', today, selectedId)
  const wellness = useAllWellness(selectedId ? seasonStart : '', today, selectedId)
  const weekLogs = useAllLogs(week?.start_date ?? '', week ? addDays(week.start_date, 6) : '')
  const weekPlan = useAllPlan(week?.start_date ?? '', week ? addDays(week.start_date, 6) : '') // RPE visé des séances
  // Taux de déclaration de la saison : planning et déclarations du groupe (jours d'entraînement réellement suivis)
  const seasonPlan = useAllPlan(selectedId ? seasonStart : '', addDays(today, -1))
  const seasonLogs = useAllLogs(selectedId ? seasonStart : '', addDays(today, -1))
  const records = useInjuryRecords() // périodes de blessure : les séances de groupe ne comptent pas ces jours-là
  const targets = useTargetRpes()
  const injury = useInjurySessions(roster.data?.find(p => p.id === selectedId)?.injured ? selectedId : undefined, addDays(today, -28), today)

  if (ref.isPending || roster.isPending) return <Loading />
  if (ref.isError || roster.isError || own.isError || wellness.isError || weekLogs.isError) return <p>Impossible de charger la fiche joueur.</p>
  const player = roster.data.find(p => p.id === selectedId)
  if (!player) return <p>Aucun joueur.</p>
  if (own.isPending || wellness.isPending || (week && weekLogs.isPending)) return <Loading />

  const wt = week ? ref.data.weekTypes.find(t => t.code === week.week_type_code) ?? null : null
  const inWeek = (l: Log) => !!week && l.session_date >= week.start_date && l.session_date <= addDays(week.start_date, 6)
  const m = week ? weekMatrix(roster.data, weekLogs.data ?? [], week.start_date, wt, { inProgress: addDays(week.start_date, 6) >= today }) : null
  const row = m?.rows.find(r => r.player.id === player.id)
  const days = week && m ? playerDays(own.data.filter(inWeek), ref.data.types, week.start_date, m.dayMeans) : []
  const ratio = acwr(own.data, today)

  return (
    <>
      {/* Ce qu'on regarde : un joueur, une semaine, une partie de sa fiche */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <ViewSelect label="Joueur" value={player.id} onChange={id => navigate(`/staff/joueur/${id}`)}>
          {roster.data.map(p => <option key={p.id} value={p.id}>{fullName(p)}{p.injured ? ' (blessé)' : ''}</option>)}
        </ViewSelect>
        <ViewSelect label="Semaine" value={week?.code ?? ''} onChange={setCode}>
          {weeks.map(w => <option key={w.code} value={w.code}>{w.code} · {w.label}</option>)}
        </ViewSelect>
        <ViewSelect label="Afficher" value={section} onChange={setSection}>
          <option value="semaine">La semaine, jour par jour</option>
          <option value="saison">La saison (charge et fatigue)</option>
          <option value="muscu">Musculation et tests</option>
          <option value="gestion">Gestion (statut, corrections, tests)</option>
        </ViewSelect>
        <span className="text-sm text-ink/60">{player.position ?? ''}{player.injured && <> · <Badge tone="warn">blessé</Badge></>}</span>
      </div>

      {row && week && (
        <section className="flex flex-col gap-4">
          <p className="max-w-4xl text-lg leading-snug">
            <strong>{fullName(player)}</strong> a déclaré {row.sessions} séance{row.sessions > 1 ? 's' : ''} en {week.code}
            {wt && <> ({wt.name.toLowerCase()})</>} : <strong>{n(row.total)} UA</strong>
            {wt && <>, soit {pct(row.pct)} de la charge visée ({n(wt.target_srpe)} UA)</>}
            {row.status
              ? <> — <strong className={STATUS_TEXT[STATUS_TONE[row.status]]}>{STATUS_WORD[row.status]}</strong>.</>
              : m?.inProgress ? <> — semaine en cours.</> : '.'}
            {' '}{row.vsGroupPct === 0 ? 'Comme la moyenne du groupe.' : `${pct(Math.abs(row.vsGroupPct))} ${row.vsGroupPct > 0 ? 'au-dessus' : 'en dessous'} de la moyenne du groupe.`}
            {isAdmin && ratio.zone && <> Ratio aigu/chronique {ratio.ratio?.toLocaleString('fr-FR')} : <strong className={STATUS_TEXT[ZONE_TONE[ratio.zone]]}>{ZONE_LABEL[ratio.zone]}</strong>.</>}
          </p>
          <div className="flex flex-wrap gap-3">
            <Kpi label="Séances déclarées" value={String(row.sessions)} />
            <Kpi label={`Charge ${week.code}`} value={`${n(row.total)} UA`} hint={wt ? `Visée ${n(wt.target_srpe)} UA` : 'Hors calendrier'} />
            <Kpi label="% de la charge visée" value={pct(row.pct)} tone={row.status ? STATUS_TONE[row.status] : 'neutral'} hint={row.status ?? (m?.inProgress ? 'semaine en cours' : undefined)} />
            <Kpi label="Écart au groupe" value={pct(row.vsGroupPct, true)} />
            <Kpi label="Temps total" value={`${n(row.minutes)} min`} />
            {player && seasonPlan.data && seasonLogs.data && (() => {
              const periods = (records.data ?? []).filter(i => i.player_id === player.id)
              const d = declarationRate(player, seasonPlan.data, seasonLogs.data, ref.data.types, seasonStart, addDays(today, -1), new Set(seasonLogs.data.map(l => l.session_date)),
                date => periods.some(i => date >= i.occurred_on && date <= (i.ended_on ?? today)))
              return d.rate === null ? null : <Kpi label="RPE déclarés (saison)" value={`${d.rate} %`} tone={d.rate >= 90 ? 'ok' : d.rate >= 70 ? 'warn' : 'bad'}
                hint={`${d.planned - d.missed} sur ${d.planned} activités prévues`} />
            })()}
            {isAdmin && (
              <Kpi label="Ratio aigu / chronique" value={ratio.ratio === null ? '—' : ratio.ratio.toLocaleString('fr-FR')}
                tone={ratio.zone ? ZONE_TONE[ratio.zone] : 'neutral'}
                hint={ratio.zone ? `4 j d'entr. ${n(ratio.acute)} / 16 j ÷ 4 ${n(ratio.chronic)} UA (lun, mar, mer, ven)` : 'Pas assez d\'historique (16 jours d\'entraînement)'} />
            )}
          </div>
        </section>
      )}

      {section === 'semaine' && player?.injured && injury.data && (
        <InjuryCard summary={injurySummary(injury.data, new Set(injury.data.filter(s => own.data.some(l => l.session_date === s.session_date
          && l.activity_type_id === s.activity_type_id && l.validated_at)).map(s => s.id)), isoWeekStart(today), today)} />
      )}

      {section === 'semaine' && (
        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Card title={`Jour par jour${week ? ` — ${week.code}` : ''}`}
            help="Minutes par pilier, effort moyen (RPE) et charge du jour (sRPE = RPE × minutes). Écart : différence avec la moyenne du groupe ce jour-là.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-ink/55">
                  <tr>{['Jour', 'Activités', 'Min', 'Rugby', 'Physique', 'Accomp.', 'RPE moy.', 'sRPE', 'Groupe', 'Écart'].map(h => <th key={h} className="py-2 pr-3 font-normal">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {days.map(d => (
                    <tr key={d.date} className="border-t border-line">
                      <td className="py-1.5 pr-3 font-semibold">{d.day}</td><td className="pr-3 text-ink/75">{d.activities || '—'}</td><td className="pr-3">{d.minutes || '—'}</td>
                      <td className="pr-3">{d.rugby || '—'}</td><td className="pr-3">{d.physique || '—'}</td><td className="pr-3">{d.accompagnement || '—'}</td>
                      <td className="pr-3">{d.avgRpe ?? '—'}</td><td className="pr-3 font-semibold">{d.srpe || '—'}</td>
                      <td className="pr-3 text-ink/60">{d.groupMean || '—'}</td>
                      <td className={d.gap > 0 ? 'text-gold' : d.gap < 0 ? 'text-ink/60' : ''}>{d.srpe || d.groupMean ? `${d.gap > 0 ? '+' : ''}${d.gap}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Journal des saisies" help="Chaque déclaration de la semaine, quand et par qui (joueur, staff ou formulaire), avec le RPE déclaré face à la fourchette visée de la séance : orange à ±2, rouge à ±3.">
            {!own.data.some(inWeek) && <p className="text-sm text-ink/70">Aucune déclaration cette semaine.</p>}
            <ul className="text-sm flex flex-col max-h-96 overflow-y-auto">
              {own.data.filter(inWeek).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((l, i) => (
                <li key={i} className="flex justify-between gap-2 border-t border-line py-1">
                  <span>{DAY_NAMES[(new Date(`${l.session_date}T00:00:00Z`).getUTCDay() + 6) % 7].slice(0, 3)}. {ref.data.types.find(t => t.id === l.activity_type_id)?.name}</span>
                  <span className="flex items-center gap-2 tabular-nums whitespace-nowrap">
                    {(() => {
                      // RPE déclaré face au RPE visé de la séance (orange à ±2, rouge à ±3)
                      const t = sessionTarget(l, weekPlan.data ?? [], week?.week_type_code, targets.data ?? []).range, g = rpeGap(l.rpe, t)
                      return l.rpe === null ? null : g?.heat ? <Badge tone={g.heat}>{rpeVsTarget(l.rpe, t)}</Badge> : <span>{rpeVsTarget(l.rpe, t)}</span>
                    })()}
                    <span className="text-ink/60">{Number(l.srpe ?? 0)} UA · {SOURCE[l.source] ?? l.source}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {section === 'saison' && <SeasonCharts own={own.data} wellness={wellness.data} weeks={weeks} weekTypes={ref.data.weekTypes} today={today} />}

      {section === 'muscu' && (
        <div className="grid items-start gap-8 lg:grid-cols-2">
          {week && <MuscuWeek playerId={player.id} from={week.start_date} />}
          <MyGoals playerId={player.id} date={today} title="Objectifs et tests" />
        </div>
      )}

      {section === 'gestion' && (
        <div className="flex flex-col gap-8">
          {isAdmin && <AvailabilityPanel player={player} today={today} />}
          <CorrectionPanel player={player} types={ref.data.types} today={today} logs={own.data} wellness={wellness.data} />
          <TestsPanel player={player} today={today} />
        </div>
      )}
    </>
  )
}

const STATUS_FILL = { 'sous-charge': BRAND.gold, conforme: BRAND.ok, surcharge: BRAND.rnr } as const

function SeasonCharts({ own, wellness, weeks, weekTypes, today }: {
  own: Log[]; wellness: { entry_date: string; score: number | null }[]
  weeks: { code: string; start_date: string; week_type_code: string }[]; weekTypes: WeekType[]; today: string
}) {
  const load = weeks.map(w => {
    const wt = weekTypes.find(t => t.code === w.week_type_code) ?? null
    const srpe = own.filter(l => l.session_date >= w.start_date && l.session_date <= addDays(w.start_date, 6)).reduce((s, l) => s + Number(l.srpe ?? 0), 0)
    const status = loadStatus(srpe, wt)
    // semaine en cours ou à venir : pas encore de verdict, barre neutre
    const fill = addDays(w.start_date, 6) >= today || !status ? BRAND.muted : STATUS_FILL[status]
    return { week: w.code, srpe, cible: wt?.target_srpe ?? null, fill }
  })
  const daily = [...wellness].sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    .flatMap(w => (w.score === null ? [] : [{ date: w.entry_date.slice(5), fatigue: fatiguePercent(w.score) }]))
  // moyenne glissante sur 7 saisies : la tendance se lit mieux que le jour par jour
  const form = daily.map((d, i) => {
    const win = daily.slice(Math.max(0, i - 6), i + 1)
    return { ...d, tendance: Math.round(win.reduce((s, x) => s + x.fatigue, 0) / win.length) }
  })
  return (
    <div className="grid items-start gap-8 lg:grid-cols-2">
      <Card title="Charge par semaine"
        help="Barre verte : dans la plage visée · jaune : sous-charge · rouge : surcharge · grise : semaine en cours. Pointillés : charge visée selon le type de semaine.">
        <div className="h-64 text-ink/60">
          <ResponsiveContainer>
            <ComposedChart data={load}>
              <CartesianGrid strokeOpacity={0.15} vertical={false} />
              <XAxis dataKey="week" tick={{ fill: 'currentColor', fontSize: 12 }} />
              <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} width={44} />
              <Tooltip formatter={(v, name) => [`${v} UA`, name === 'srpe' ? 'Charge' : 'Visée']} />
              <Bar dataKey="srpe" name="srpe" radius={[4, 4, 0, 0]}>{load.map(l => <Cell key={l.week} fill={l.fill} />)}</Bar>
              <Line type="stepAfter" dataKey="cible" name="cible" stroke={BRAND.gold} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Fatigue estimée"
        help="D'après l'état de forme : 0 % = en pleine forme, 100 % = épuisé. Trait plein : moyenne sur 7 jours. Pointillés rouges : seuil d'alerte.">
        {form.length === 0 ? <p className="text-sm text-ink/70">Aucun état de forme rempli depuis le début de la saison.</p> : (
          <div className="h-64 text-ink/60">
            <ResponsiveContainer>
              <LineChart data={form}>
                <CartesianGrid strokeOpacity={0.15} vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'currentColor', fontSize: 11 }} minTickGap={24} />
                <YAxis domain={[0, 100]} tick={{ fill: 'currentColor', fontSize: 12 }} width={36} unit="%" />
                <Tooltip formatter={(v, name) => [`${v} %`, name === 'tendance' ? 'Moyenne 7 j' : 'Jour']} />
                <ReferenceLine y={fatiguePercent(WELLNESS_ALERT_SCORE)} stroke={BRAND.rnr} strokeDasharray="4 4" />
                <Line dataKey="fatigue" name="fatigue" stroke={BRAND.muted} strokeOpacity={0.5} dot={false} strokeWidth={1} />
                <Line dataKey="tendance" name="tendance" stroke={BRAND.gold} dot={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  )
}

function MuscuWeek({ playerId, from }: { playerId: string; from: string }) {
  const program = useWeekProgram(playerId, from, addDays(from, 6))
  return (
    <Card title="Séances à exercices de la semaine" help="Musculation (réhab et membres sains pour un blessé) : part des exercices notés « fait » par le joueur, séance par séance.">
      {!program.data?.length && <p className="text-sm text-ink/70">Pas de séance de musculation cette semaine.</p>}
      <ul className="text-sm flex flex-col gap-1">
        {program.data?.map(s => {
          const c = completion(s.planned_exercises)
          return (
            <li key={s.id} className="flex justify-between border-t border-line pt-1">
              <span>{DAY_NAMES[(new Date(`${s.session_date}T00:00:00Z`).getUTCDay() + 6) % 7]}{s.activity_types.name !== 'Musculation' && <span className="text-ink/60"> · {s.activity_types.name}</span>}</span>
              <span>{c.done}/{c.total} exercices faits · <Badge tone={c.pct >= 80 ? 'ok' : c.pct >= 50 ? 'warn' : 'bad'}>{c.pct} %</Badge></span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

// Joueur blessé : assiduité de la réhab sur la semaine et douleur EVA exercice par exercice (4 dernières semaines)
function InjuryCard({ summary: s }: { summary: ReturnType<typeof injurySummary> }) {
  const tone = (v: number) => (v >= 7 ? 'text-rnr' : v >= 4 ? 'text-gold' : 'text-ok')
  return (
    <Card title="Suivi blessé" help="Séances de réhabilitation et membres sains validées cette semaine (jusqu'à aujourd'hui), et douleur EVA (0 : aucune, 10 : maximale) déclarée sur chaque exercice depuis 4 semaines. Flèche : évolution depuis la première mesure.">
      <div className="flex flex-wrap gap-3">
        <Kpi label="Séances faites cette semaine" value={`${s.done} / ${s.planned}`} tone={s.planned && s.done < s.planned ? 'warn' : 'ok'} />
        {s.byType.map(t => <Kpi key={t.type} label={t.type} value={`${t.done} / ${t.planned}`} />)}
      </div>
      {!s.pain.length ? <p className="text-sm text-ink/60">Aucune douleur déclarée sur les exercices pour l'instant.</p> : (
        <table className="text-sm">
          <thead className="text-left text-ink/60"><tr><th className="py-1 pr-4 font-normal">Exercice</th><th className="pr-4 font-normal">Dernière</th><th className="pr-4 font-normal">Évolution</th><th className="font-normal">Historique</th></tr></thead>
          <tbody>
            {s.pain.map(p => (
              <tr key={p.name} className="border-t border-line">
                <td className="py-1 pr-4 font-semibold">{p.name}</td>
                <td className={`pr-4 font-semibold tabular-nums ${tone(p.last)}`}>{p.last}/10</td>
                <td className={`pr-4 tabular-nums ${p.trend < 0 ? 'text-ok' : p.trend > 0 ? 'text-rnr' : 'text-ink/60'}`}>{p.trend < 0 ? `↓ ${-p.trend}` : p.trend > 0 ? `↑ ${p.trend}` : '='}</td>
                <td className="tabular-nums text-ink/70">{p.points.map(x => `${x.date.slice(8, 10)}/${x.date.slice(5, 7)} : ${x.pain}`).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

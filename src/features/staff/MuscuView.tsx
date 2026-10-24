import { Fragment, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { BRAND } from '../../lib/brand'
import { addDays, formatDay, parisDate } from '../../lib/week'
import { MUSCULATION } from '../rpe/activities'
import { prescription, sortedExercises } from '../seances/program'
import { fullName, weekOf } from './load'
import { loadProgression, muscuSummary, respected, trackedExercises, type Respect, type StaffMuscuSession } from './muscu'
import { useAllLogs, useReference, useRoster, useStaffMuscu } from './useStaff'

const RESPECT: Record<Exclude<Respect, null>, { tone: 'ok' | 'warn' | 'bad'; label: string }> = {
  oui: { tone: 'ok', label: 'respectée' }, partiel: { tone: 'warn', label: 'partielle' }, non: { tone: 'bad', label: 'non respectée' },
}
const STATUS_LABEL: Record<string, string> = { fait: 'Fait', partiel: 'Partiel', 'non fait': 'Non fait' }
const select = 'rounded-lg bg-surface border border-line px-3 py-2'

export function MuscuView() {
  const today = parisDate()
  const ref = useReference()
  const roster = useRoster()
  const [code, setCode] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const weeks = ref.data?.weeks ?? []
  const week = weeks.find(w => w.code === code) ?? weekOf(weeks, today)
  const from = week?.start_date ?? ''
  const to = week ? addDays(week.start_date, 6) : ''
  const sessions = useStaffMuscu(from, to)
  const logs = useAllLogs(from, to)

  if (ref.isPending || roster.isPending || (week && (sessions.isPending || logs.isPending))) return <p className="text-ink/60">Chargement…</p>
  if (ref.isError || roster.isError || sessions.isError || logs.isError) return <p>Impossible de charger la musculation.</p>
  if (!week) return <p>Aucune semaine dans le calendrier.</p>

  const muscuId = ref.data.types.find(t => t.name === MUSCULATION)?.id
  const rows = roster.data.map(p => {
    const own = (sessions.data ?? []).filter(s => s.player_id === p.id).sort((a, b) => a.session_date.localeCompare(b.session_date))
    const rpes = (logs.data ?? []).filter(l => l.player_id === p.id && l.activity_type_id === muscuId && l.rpe !== null).map(l => Number(l.rpe))
    return { player: p, own, summary: muscuSummary(own, rpes) }
  }).filter(r => r.own.length)

  return (
    <>
      <label className="flex flex-col gap-1 text-sm self-start">
        Semaine
        <select value={week.code} onChange={e => setCode(e.target.value)} className={select}>
          {weeks.map(w => <option key={w.code} value={w.code}>{w.code} · {w.label} · {w.start_date}</option>)}
        </select>
      </label>

      <Card title={`Vue d'ensemble musculation — ${week.code}`}>
        {rows.length === 0 && <p className="text-sm text-ink/70">Aucune séance de musculation programmée cette semaine.</p>}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-ink/60">
                <tr>{['Joueur', 'Séances', 'Exercices faits', 'RPE de séance moyen', 'Exercice le plus dur', 'Charges', ''].map(h => <th key={h} className="py-2 pr-3 font-normal">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(({ player, own, summary: s }) => (
                  <Fragment key={player.id}>
                    <tr className="border-t border-line">
                      <td className="py-2 pr-3 font-semibold">{fullName(player)}</td>
                      <td className="pr-3">{s.sessions}</td>
                      <td className="pr-3"><Badge tone={s.completionPct >= 80 ? 'ok' : s.completionPct >= 50 ? 'warn' : 'bad'}>{s.done}/{s.exercises} · {s.completionPct} %</Badge></td>
                      <td className="pr-3">{s.sessionRpe ?? '—'}</td>
                      <td className="pr-3">{s.hardest ? `${s.hardest.name} (RPE ${s.hardest.rpe})` : '—'}</td>
                      <td className="pr-3 whitespace-nowrap">
                        <span className="mr-1"><Badge tone="ok">✓ {s.respected}</Badge></span>
                        <span className="mr-1"><Badge tone="warn">~ {s.partial}</Badge></span>
                        <Badge tone="bad">✗ {s.notRespected}</Badge>
                      </td>
                      <td>
                        <button type="button" aria-expanded={open === player.id} onClick={() => setOpen(open === player.id ? null : player.id)}
                          className="rounded-lg border border-line px-3 py-1.5">{open === player.id ? 'Masquer' : 'Détail'}</button>
                      </td>
                    </tr>
                    {open === player.id && (
                      <tr><td colSpan={7} className="pb-4"><SessionsDetail sessions={own} /></td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-ink/60">
          Charge respectée : exercice fait et, si la prescription est en kg, charge réalisée ≥ charge prescrite.
          En %RM ou charge libre, seul le statut compte.
        </p>
      </Card>

      <Progression players={roster.data} seasonStart={weeks[0]?.start_date ?? addDays(today, -90)} today={today} />
    </>
  )
}

function SessionsDetail({ sessions }: { sessions: StaffMuscuSession[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-app p-3">
      {sessions.map(s => (
        <div key={s.id}>
          <p className="font-semibold capitalize">{formatDay(s.session_date)}</p>
          <table className="w-full text-xs">
            <thead className="text-left text-ink/60">
              <tr>{['Bloc', 'Exercice', 'Prescrit', 'Réalisé', 'RPE', 'Statut', 'Charge', 'Commentaire'].map(h => <th key={h} className="py-1 pr-2 font-normal">{h}</th>)}</tr>
            </thead>
            <tbody>
              {sortedExercises(s.planned_exercises).map(e => {
                const f = e.exercise_feedback[0]
                const r = respected(e, f)
                return (
                  <tr key={e.id} className="border-t border-line">
                    <td className="py-1 pr-2">{e.block_label}</td><td className="pr-2">{e.exercises.name}</td>
                    <td className="pr-2">{prescription(e)}</td><td className="pr-2">{f?.done_load ?? '—'}</td>
                    <td className="pr-2">{f?.rpe ?? '—'}</td><td className="pr-2">{f?.status ? STATUS_LABEL[f.status] : 'pas de retour'}</td>
                    <td className="pr-2">{r ? <Badge tone={RESPECT[r].tone}>{RESPECT[r].label}</Badge> : '—'}</td>
                    <td>{f?.comment ?? ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function Progression({ players, seasonStart, today }: { players: { id: string; first_name: string; last_name: string }[]; seasonStart: string; today: string }) {
  const [playerId, setPlayerId] = useState(players[0]?.id ?? '')
  const [exercise, setExercise] = useState('')
  const season = useStaffMuscu(playerId ? seasonStart : '', today, playerId || undefined)
  const options = trackedExercises(season.data ?? [])
  const chosen = options.includes(exercise) ? exercise : options[0] ?? ''
  const points = loadProgression(season.data ?? [], chosen).map(p => ({ ...p, date: p.date.slice(5) }))

  return (
    <Card title="Progression de charge">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Joueur
          <select value={playerId} onChange={e => setPlayerId(e.target.value)} className={select}>
            {players.map(p => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Exercice
          <select value={chosen} onChange={e => setExercise(e.target.value)} className={select} disabled={!options.length}>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>
      {season.isPending && <p className="text-ink/60">Chargement…</p>}
      {season.isSuccess && points.length === 0 && <p className="text-sm text-ink/70">Aucune charge réalisée lisible pour ce joueur.</p>}
      {points.length > 0 && (
        <div className="h-64 text-ink/60">
          <ResponsiveContainer>
            <LineChart data={points}>
              <CartesianGrid strokeOpacity={0.15} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'currentColor', fontSize: 12 }} />
              <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} width={44} unit=" kg" />
              <Tooltip />
              <Legend />
              <Line dataKey="done" name="Charge réalisée (max)" stroke={BRAND.gold} strokeWidth={2} connectNulls />
              <Line dataKey="prescribed" name="Charge prescrite (kg)" stroke={BRAND.rnr} strokeDasharray="4 4" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-xs text-ink/60">Charge réalisée lue dans la saisie du joueur (ex. « 2x125 1x120 » → 125 kg).</p>
    </Card>
  )
}

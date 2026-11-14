import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, Flame, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ConfirmButton } from '../../components/ui/ConfirmButton'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { addDays } from '../../lib/week'
import { useWellnessRange } from '../wellness/useWellness'
import { TARGET_MIN, hm, sleepDuration, sleepStats, streak } from './sleep'
import { useEnrollments, useGoals } from './useFollow'
import { useAddRoutine, useRoutineChecks, useRoutines, useSaveSleep, useSetRoutineActive, useSleepEntries, type Routine, type SleepEntry } from './useSleep'

const field = 'rounded-lg border border-line bg-field px-2 py-2.5 text-center text-base tabular-nums'
const hhmm = (t: string) => t.slice(0, 5)
const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
const HISTORY = 14 // nuits affichées dans le détail

// Choix en une touche : de vrais boutons radio (flèches du clavier, lecteur d'écran) habillés en puces de 44 px
function Chips<T extends number | string>({ label, value, options, onChange }: {
  label: string; value: T | null; options: readonly (readonly [T, string])[]; onChange: (v: T) => void
}) {
  const name = useId()
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1.5">
        {options.map(([v, text]) => (
          <label key={String(v)} className="flex min-h-11 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg border border-line px-1 text-sm font-semibold text-ink/75 transition-transform duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-app has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold">
            <input type="radio" name={name} className="sr-only" checked={value === v} onChange={() => onChange(v)} />{text}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

// Saisie d'une nuit : heures préremplies avec celles de la dernière nuit, le reste en une touche
function SleepForm({ playerId, night, last, entry, routines, checked, onDone }: {
  playerId: string; night: string; last?: SleepEntry; entry?: SleepEntry; routines: Routine[]; checked: string[]; onDone?: () => void
}) {
  const save = useSaveSleep(playerId)
  const from = entry ?? last
  const [bed, setBed] = useState(hhmm(from?.bed_time ?? ''))
  const [asleep, setAsleep] = useState(hhmm(from?.asleep_time ?? ''))
  const [wake, setWake] = useState(hhmm(from?.wake_time ?? ''))
  const [phone, setPhone] = useState<number | null>(entry?.phone_free_min ?? null)
  const [wakes, setWakes] = useState<number | null>(entry?.awakenings ?? null)
  const [awake, setAwake] = useState<number>(entry?.awake_min ?? 0)
  const [feeling, setFeeling] = useState<string | null>(entry?.feeling ?? null)
  const [done, setDone] = useState<string[]>(checked)
  const [nap, setNap] = useState<number | null>(entry?.nap_min ?? null)
  const [caffeine, setCaffeine] = useState<boolean | null>(entry?.caffeine_late ?? null)
  const [note, setNote] = useState(entry?.note ?? '')
  const times = [bed, asleep, wake].every(t => /^\d\d:\d\d$/.test(t))
  const duration = times ? sleepDuration(asleep, wake, wakes ? awake : 0) : 0
  // Endormi au plus 4 h après s'être mis au lit : au-delà, une des deux heures est fausse (même règle en base)
  const coherent = times && sleepDuration(bed, asleep) <= 240
  const valid = coherent && phone !== null && wakes !== null && feeling !== null && (wakes === 0 || awake > 0)
  const time = (label: string, value: string, set: (v: string) => void) => (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-ink/60">{label}
      <input type="time" value={value} onChange={e => set(e.target.value)} className={`${field} text-ink`} />
    </label>
  )
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {time('Au lit', bed, setBed)}{time('Endormi vers', asleep, setAsleep)}{time('Réveil', wake, setWake)}
      </div>
      <p className="rounded-xl bg-field px-4 py-2.5 text-center" aria-live="polite">
        <span className="font-display text-3xl font-semibold tabular-nums">{times ? hm(duration) : '—'}</span> <span className="text-sm text-ink/60">de sommeil</span>
      </p>
      {times && !coherent && <p role="alert" className="text-sm text-rnr">Vérifie tes heures : « Endormi vers » doit venir après « Au lit ».</p>}
      <Chips label="Minutes sans téléphone avant de dormir" value={phone} onChange={setPhone} options={[[0, '0'], [15, '15'], [30, '30'], [45, '45'], [60, '1\u00a0h'], [90, '1\u00a0h\u00a030']]} />
      <Chips label="Réveils dans la nuit" value={wakes} onChange={v => { setWakes(v); if (v === 0) setAwake(0) }} options={[[0, 'Aucun'], [1, '1'], [2, '2'], [3, '3'], [4, '4 et +']]} />
      {!!wakes && <Chips label="Temps éveillé en tout" value={awake || null} onChange={setAwake} options={[[5, '5\u00a0min'], [15, '15'], [30, '30'], [60, '1\u00a0h'], [90, '1\u00a0h\u00a030']]} />}
      <Chips label="Au réveil, je me sens" value={feeling} onChange={setFeeling} options={[['repose', 'Reposé'], ['fatigue', 'Fatigué']]} />
      {routines.length > 0 && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold">Mes routines d'hier soir</legend>
          {routines.map(r => (
            <label key={r.id} className="flex min-h-11 items-center gap-3 rounded-lg px-1 text-sm">
              <input type="checkbox" className="h-5 w-5 shrink-0" checked={done.includes(r.id)} onChange={e => setDone(e.target.checked ? [...done, r.id] : done.filter(x => x !== r.id))} />{r.label}
            </label>
          ))}
        </fieldset>
      )}
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm text-ink/60">Sieste, caféine, note (facultatif)<ChevronDown size={16} aria-hidden="true" className="transition-transform group-open:rotate-180" /></summary>
        <div className="flex flex-col gap-4 pt-2">
          <Chips label="Sieste hier" value={nap} onChange={setNap} options={[[0, 'Non'], [20, '20\u00a0min'], [40, '40'], [60, '1\u00a0h'], [90, '1\u00a0h\u00a030']]} />
          <Chips label="Caféine après 16 h (café, soda, boisson énergisante)" value={caffeine === null ? null : caffeine ? 'oui' : 'non'} onChange={v => setCaffeine(v === 'oui')} options={[['non', 'Non'], ['oui', 'Oui']]} />
          <label className="flex flex-col gap-1 text-sm font-semibold">Note
            <textarea rows={2} maxLength={300} value={note} onChange={e => setNote(e.target.value)} className="rounded-lg border border-line bg-field px-3 py-2 text-base font-normal" />
          </label>
        </div>
      </details>
      {save.isError && <p role="alert" className="rounded-lg bg-rnr/15 px-3 py-2 text-sm ring-1 ring-rnr/50">Nuit non enregistrée, réessaie.</p>}
      <div className="flex gap-2">
        <Button className="flex-1" disabled={!valid || save.isPending} onClick={() => save.mutate({
          entry: { night_date: night, bed_time: bed, asleep_time: asleep, wake_time: wake, awakenings: wakes!, awake_min: wakes ? awake : 0, phone_free_min: phone!, feeling: feeling!,
            nap_min: nap, caffeine_late: caffeine, note: note.trim() || null },
          routines: routines.map(r => ({ id: r.id, checked: done.includes(r.id) })),
        }, { onSuccess: onDone })}>{save.isPending ? 'Enregistrement…' : 'Enregistrer ma nuit'}</Button>
        {onDone && <Button variant="ghost" onClick={onDone}>Annuler</Button>}
      </div>
    </div>
  )
}

// En haut de l'onglet Suivi, juste après l'état de forme : la nuit à saisir, tant qu'elle ne l'est pas
export default function SleepToday({ playerId, today }: { playerId: string; today: string }) {
  const enrollments = useEnrollments(playerId)
  const goals = useGoals(playerId)
  const enrolled = enrollments.data?.find(e => e.module_code === 'sommeil' && e.status === 'actif' && e.consented_at)
  const ready = !!enrolled && !!goals.data?.some(g => g.enrollment_id === enrolled.id && g.status === 'en_cours')
  return ready ? <Pending playerId={playerId} today={today} /> : null
}
function Pending({ playerId, today }: { playerId: string; today: string }) {
  const entries = useSleepEntries(playerId, addDays(today, -HISTORY))
  const routines = useRoutines(playerId)
  if (entries.isError || routines.isError) return <Card boxed title="Ma nuit"><p role="alert" className="text-sm">Impossible de charger ta nuit. Vérifie ta connexion.</p></Card>
  if (!entries.data || !routines.data || entries.data.some(e => e.night_date === today)) return null
  return (
    <Card boxed title="Ma nuit" help="Ta nuit dernière, en quelques touches.">
      <SleepForm playerId={playerId} night={today} last={entries.data[0]} routines={routines.data.filter(r => r.active)} checked={[]} />
    </Card>
  )
}

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="flex flex-col rounded-xl bg-field px-3 py-2.5">
      <dt className="text-xs text-ink/60">{label}</dt>
      <dd className="font-display text-2xl font-semibold leading-tight tabular-nums">{value}</dd>
      {sub && <dd className="text-[11px] leading-tight text-ink/60">{sub}</dd>}
    </div>
  )
}

// Le module sommeil dans sa carte : la nuit dernière en 4 chiffres, la semaine, les routines, puis le détail nuit par nuit
export function SleepModule({ playerId, today, staff = false }: { playerId: string; today: string; staff?: boolean }) {
  const from = addDays(today, -HISTORY)
  const entries = useSleepEntries(playerId, from)
  const routines = useRoutines(playerId)
  const checks = useRoutineChecks(playerId, addDays(today, -60))
  const wellness = useWellnessRange(playerId, from, today)
  const [editing, setEditing] = useState(false)
  const [detail, setDetail] = useState(false)
  if (entries.isPending || routines.isPending || checks.isPending) return <Loading />
  if (entries.isError || routines.isError || checks.isError) return <p role="alert" className="text-sm">Impossible de charger le sommeil.</p>

  const quality = (d: string) => wellness.data?.find(w => w.entry_date === d)?.sleep_quality ?? null
  const night = entries.data.find(e => e.night_date === today) ?? (staff ? entries.data[0] : undefined)
  const stats = sleepStats(entries.data, today)
  const active = routines.data.filter(r => r.active)
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map(d => ({ d, e: entries.data.find(x => x.night_date === d) }))
  const max = Math.max(TARGET_MIN * 1.15, ...week.map(x => x.e?.duration_min ?? 0))

  if (editing && night) return (
    <SleepForm playerId={playerId} night={night.night_date} entry={night} routines={active}
      checked={checks.data.filter(c => c.night_date === night.night_date).map(c => c.routine_id)} onDone={() => setEditing(false)} />
  )
  return (
    <div className="flex flex-col gap-4">
      {night ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold">{night.night_date === today ? 'Cette nuit' : `Dernière nuit saisie · ${shortDay(night.night_date)}`}</span>
            <span className="text-ink/60">{hhmm(night.bed_time)} → {hhmm(night.wake_time)} · {night.feeling === 'repose' ? 'reposé' : 'fatigué'} au réveil</span>
          </p>
          <dl className="grid grid-cols-2 gap-2">
            <Tile label="Sommeil" value={hm(night.duration_min)} sub={`endormi vers ${hhmm(night.asleep_time)}`} />
            <Tile label="Qualité" value={quality(night.night_date) !== null ? <>{quality(night.night_date)}<span className="text-base text-ink/60"> / 5</span></> : '—'} sub="notée dans l'état de forme" />
            <Tile label="Réveils" value={night.awakenings} sub={night.awakenings ? `${night.awake_min} min éveillé` : 'nuit d\'une traite'} />
            <Tile label="Sans téléphone" value={<>{night.phone_free_min}<span className="text-base text-ink/60"> min</span></>} sub="avant de dormir" />
          </dl>
          {!staff && night.night_date === today && <Button variant="quiet" className="self-start" onClick={() => setEditing(true)}>Modifier ma nuit</Button>}
        </div>
      ) : <p className="rounded-lg bg-field px-3 py-2.5 text-sm text-ink/75">{staff ? 'Aucune nuit saisie pour l\'instant.' : wellness.data?.some(w => w.entry_date === today)
        ? 'Ta nuit n\'est pas encore saisie : remplis-la en haut de la page.' : 'Remplis d\'abord ton état de forme : ta nuit se saisit juste après.'}</p>}

      {stats && (
        <div className="flex flex-col gap-2 border-t border-line/60 pt-3">
          <p className="text-sm font-semibold">7 derniers jours <span className="font-normal text-ink/60">· {stats.nights} nuit{stats.nights > 1 ? 's' : ''} saisie{stats.nights > 1 ? 's' : ''}</span></p>
          {/* Une barre par nuit ; le trait marque le repère de 8 h */}
          <ol className="grid grid-cols-7 gap-1.5" aria-label="Durée de sommeil des 7 dernières nuits">
            {week.map(({ d, e }) => (
              <li key={d} className="flex flex-col items-center gap-1" aria-label={`${shortDay(d)} : ${e ? hm(e.duration_min) : 'pas de saisie'}`}>
                <div className="relative flex h-16 w-full items-end justify-center rounded-md bg-field" aria-hidden="true">
                  <span className="absolute inset-x-0 border-t border-dashed border-ink/40" style={{ bottom: `${(100 * TARGET_MIN) / max}%` }} />
                  {e && <div className={`w-1/2 rounded-sm ${e.duration_min >= TARGET_MIN ? 'bg-ok' : e.duration_min >= TARGET_MIN - 60 ? 'bg-gold' : 'bg-rnr'}`} style={{ height: `${Math.max(6, (100 * e.duration_min) / max)}%` }} />}
                </div>
                <span aria-hidden="true" className={`font-display text-xs font-semibold ${d === today ? 'text-ink' : 'text-ink/60'}`}>{shortDay(d).slice(0, 3)}</span>
              </li>
            ))}
          </ol>
          <dl className="grid grid-cols-3 gap-2">
            <Tile label="Moyenne" value={hm(stats.average)} sub="par nuit" />
            <Tile label="Dette" value={hm(stats.debt)} sub="sous 8 h, sur 7 jours" />
            <Tile label="Horaires" value={<span className="text-lg">{stats.regularity ?? '—'}</span>} sub={stats.drift !== null ? `± ${stats.drift} min` : 'après 3 nuits'} />
          </dl>
        </div>
      )}

      <Routines playerId={playerId} routines={routines.data} checks={checks.data} today={today} staff={staff} />

      <button type="button" onClick={() => setDetail(!detail)} aria-expanded={detail}
        className="flex min-h-11 items-center justify-between border-t border-line/60 pt-1 text-sm font-semibold text-gold">
        Voir le détail nuit par nuit<ChevronDown size={18} aria-hidden="true" className={`transition-transform ${detail ? 'rotate-180' : ''}`} />
      </button>
      {detail && (!entries.data.length ? <p className="text-sm text-ink/60">Aucune nuit saisie sur les {HISTORY} derniers jours.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <caption className="sr-only">Mes {HISTORY} dernières nuits</caption>
            <thead className="text-left text-xs text-ink/60"><tr><th scope="col" className="py-1 pr-2 font-normal">Nuit</th><th scope="col" className="pr-2 font-normal">Sommeil</th><th scope="col" className="pr-2 font-normal">Qualité</th><th scope="col" className="pr-2 font-normal">Réveils</th><th scope="col" className="font-normal">Sans tél.</th></tr></thead>
            <tbody>
              {entries.data.map(e => (
                <tr key={e.night_date} className="border-t border-line/60">
                  <td className="whitespace-nowrap py-1.5 pr-2"><span className="font-semibold first-letter:uppercase">{shortDay(e.night_date)}</span><span className="block text-xs text-ink/60">{hhmm(e.bed_time)} → {hhmm(e.wake_time)}</span></td>
                  <td className={`pr-2 font-semibold ${e.duration_min >= TARGET_MIN ? 'text-ok' : e.duration_min < TARGET_MIN - 60 ? 'text-rnr' : ''}`}>{hm(e.duration_min)}</td>
                  <td className="pr-2">{quality(e.night_date) ?? '—'}{quality(e.night_date) !== null && <span className="text-ink/60">/5</span>}</td>
                  <td className="pr-2">{e.awakenings}{e.awakenings > 0 && <span className="text-xs text-ink/60"> · {e.awake_min}'</span>}</td>
                  <td>{e.phone_free_min} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// Routines du soir : cochées dans la saisie du matin, comptées en jours d'affilée ; un oubli ne s'affiche pas comme une faute
// staff : l'admin peut proposer une routine, pas retirer celles du joueur
function Routines({ playerId, routines, checks, today, staff }: { playerId: string; routines: Routine[]; checks: { routine_id: string; night_date: string }[]; today: string; staff: boolean }) {
  const add = useAddRoutine(playerId)
  const setActive = useSetRoutineActive()
  const [label, setLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const active = routines.filter(r => r.active)
  return (
    <div className="flex flex-col gap-2 border-t border-line/60 pt-3">
      <p className="text-sm font-semibold">Routines du soir</p>
      {!active.length && !adding && <p className="text-sm text-ink/60">Une habitude à installer ? Par exemple « Écrans coupés à 22 h ».</p>}
      <ul className="flex flex-col gap-1">
        {active.map(r => {
          const n = streak(checks.filter(c => c.routine_id === r.id).map(c => c.night_date), today)
          return (
            <li key={r.id} className="flex min-h-11 items-center justify-between gap-2 text-sm">
              <span className="min-w-0">{r.label}</span>
              <span className="flex shrink-0 items-center gap-2">
                {n > 0 && <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold"><Flame size={13} aria-hidden="true" />{n} jour{n > 1 ? 's' : ''}</span>}
                {!staff && <ConfirmButton variant="quiet" confirmLabel="Confirmer" disabled={setActive.isPending} onClick={() => setActive.mutate({ id: r.id, active: false })}>Retirer</ConfirmButton>}
              </span>
            </li>
          )
        })}
      </ul>
      {!staff && routines.some(r => !r.active) && (
        <details className="text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center text-ink/60">Routines retirées · {routines.filter(r => !r.active).length}</summary>
          <ul className="flex flex-col">{routines.filter(r => !r.active).map(r => (
            <li key={r.id} className="flex min-h-11 items-center justify-between gap-2"><span className="min-w-0 text-ink/60">{r.label}</span>
              <Button variant="quiet" disabled={setActive.isPending || active.length >= 5} onClick={() => setActive.mutate({ id: r.id, active: true })}>Remettre</Button></li>
          ))}</ul>
        </details>
      )}
      {adding ? (
        <div className="flex gap-2">
          <input value={label} maxLength={80} autoFocus onChange={e => setLabel(e.target.value)} aria-label="Nouvelle routine" placeholder="Lire 30 min avant de dormir"
            className="min-w-0 flex-1 rounded-lg border border-line bg-field px-3 py-2.5 text-base" />
          <Button size="sm" disabled={label.trim().length < 2 || add.isPending} onClick={() => add.mutate(label, { onSuccess: () => { setLabel(''); setAdding(false) } })}>Ajouter</Button>
        </div>
      ) : active.length < 5 && <button type="button" onClick={() => setAdding(true)} className="flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-gold"><Plus size={16} aria-hidden="true" />Ajouter une routine</button>}
      {(add.isError || setActive.isError) && <p role="alert" className="text-sm text-rnr">Action impossible, réessaie.</p>}
    </div>
  )
}

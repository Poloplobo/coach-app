import { useEffect, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loading } from '../../components/ui/Loading'
import { BRAND } from '../../lib/brand'
import { addDays, parisDate } from '../../lib/week'
import { RATING_LABEL } from '../performance/gps'
import { useGpsRecords, useGpsReference, useMatches, useRatings } from '../performance/usePerformance'
import { MUSCULATION } from '../rpe/activities'
import { fullName, type PlanItem, type Skip, type Status } from './load'
import { blockName, blockSummary, blocksOf, chosenBlock, coachSummary, comparisonBlock, cycleHighlights, cycleSummary, type Block, type Wellness } from './summary'
import { SUMMARY, type Tone } from './summaryConfig'
import { useAllLogs, useAllPlan, useAllSkips, useAllWellness, useInjuryRecords, useIsAdmin, useReference, useRoster, useStaffMuscu } from './useStaff'

// Résumés du bloc, du cycle et du coach : une feuille A4 claire (quel que soit le thème de l'app), envoyée à l'impression
// du navigateur (« Enregistrer au format PDF »). Rien ne passe par un service tiers. Le titre de l'onglet donne le nom du fichier.

const NR = 'Non renseigné'
const n = (v: number | null | undefined, unit = '') => (v == null ? NR : `${v.toLocaleString('fr-FR')}${unit}`)
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const period = (from: string, to: string) => `du ${day(from)} au ${new Date(`${to}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`
// Sur papier blanc : texte foncé et fond pâle (le jaune or de l'app y serait illisible)
const TONE: Record<Tone, string> = { ok: 'bg-emerald-100 text-emerald-900', warn: 'bg-amber-100 text-amber-900', bad: 'bg-red-100 text-red-900', neutral: '' }
const STATUS_FILL: Record<Status, string> = { conforme: BRAND.ok, 'sous-charge': '#D97706', surcharge: BRAND.rnr }
const STATUS_WORD: Record<Status, string> = { conforme: 'dans la plage', 'sous-charge': 'sous-charge', surcharge: 'surcharge' }
const signed = (v: number | null) => (v === null ? NR : `${v > 0 ? '+' : ''}${v} %`)

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 break-after-avoid border-b border-neutral-300 pb-0.5 font-display text-base font-semibold uppercase tracking-wide text-[#C8102E]">{title}</h2>
      {children}
    </section>
  )
}
const Empty = ({ children = NR }: { children?: ReactNode }) => <p className="text-neutral-500">{children}</p>
function Figures({ items }: { items: [label: string, value: string, hint?: string][] }) {
  return (
    <dl className="mb-2 grid break-inside-avoid grid-cols-4 gap-x-4 gap-y-2">
      {items.map(([label, value, hint]) => (
        <div key={label} className="border-l-2 border-neutral-300 pl-2">
          <dt className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</dt>
          <dd className={`font-display font-semibold leading-tight tabular-nums ${value === NR ? 'text-sm text-neutral-500' : 'text-xl'}`}>{value}</dd>
          {hint && <dd className="text-[10px] text-neutral-500">{hint}</dd>}
        </div>
      ))}
    </dl>
  )
}
// left : colonnes de texte, alignées à gauche (les chiffres restent à droite)
function Table({ head, rows, left = [0] }: { head: string[]; rows: ReactNode[][]; left?: number[] }) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead><tr>{head.map((h, i) => <th key={h} scope="col" className={`border-b border-neutral-400 py-1 pr-2 font-semibold ${left.includes(i) ? 'text-left' : 'text-right'}`}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="break-inside-avoid border-b border-neutral-200">{r.map((c, j) => <td key={j} className={`py-1 pr-2 align-top ${left.includes(j) ? '' : 'whitespace-nowrap text-right tabular-nums'}`}>{c}</td>)}</tr>)}</tbody>
    </table>
  )
}
const Cell = ({ tone, children }: { tone: Tone; children: ReactNode }) => <span className={`inline-block min-w-12 rounded px-1.5 py-0.5 text-center [print-color-adjust:exact] ${TONE[tone]}`}>{children}</span>

// Barres dessinées en SVG (net à l'impression, sans dépendre de la largeur de l'écran) : valeur au-dessus, repère de la
// cible en trait, plage visée en fond. Une barre sans valeur (semaine à venir) reste vide.
function Bars({ items, unit = '' }: { items: { label: string; value: number | null; fill?: string; target?: number | null; min?: number | null; max?: number | null; note?: string }[]; unit?: string }) {
  const W = 680, H = 150, top = 16, bottom = 30, slot = W / Math.max(items.length, 1), bar = Math.min(64, slot * 0.6)
  const peak = Math.max(1, ...items.flatMap(i => [i.value ?? 0, i.target ?? 0, i.max ?? 0])) * 1.08
  const y = (v: number) => top + (H - top - bottom) * (1 - v / peak)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full break-inside-avoid [print-color-adjust:exact]" role="img" aria-label={items.map(i => `${i.label} : ${i.value ?? 'non renseigné'}${unit}`).join(', ')}>
      <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} stroke="#a3a3a3" />
      {items.map((i, k) => {
        const x = k * slot + (slot - bar) / 2
        return (
          <g key={i.label}>
            {i.min != null && <rect x={k * slot + 6} width={slot - 12} y={y(i.max ?? peak / 1.08)} height={y(i.min) - y(i.max ?? peak / 1.08)} fill="#e5e5e5" />}
            {i.value != null && <rect x={x} width={bar} y={y(i.value)} height={H - bottom - y(i.value)} rx="2" fill={i.fill ?? '#404040'} />}
            {i.target != null && i.target > 0 && <line x1={k * slot + 6} x2={(k + 1) * slot - 6} y1={y(i.target)} y2={y(i.target)} stroke="#171717" strokeDasharray="4 3" />}
            <text x={x + bar / 2} y={(i.value != null ? y(i.value) : H - bottom) - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="#171717">{i.value != null ? `${i.value.toLocaleString('fr-FR')}${unit}` : '—'}</text>
            <text x={x + bar / 2} y={H - bottom + 12} textAnchor="middle" fontSize="11" fill="#171717">{i.label}</text>
            {i.note && <text x={x + bar / 2} y={H - bottom + 24} textAnchor="middle" fontSize="9" fill="#737373">{i.note}</text>}
          </g>
        )
      })}
    </svg>
  )
}
const weekBars = (weekly: { code: string; type: string; total: number; target: number; min: number | null; max: number | null; status: Status | null; inProgress: boolean; future: boolean }[]) =>
  weekly.map(w => ({ label: w.code, value: w.future ? null : w.total, target: w.target, min: w.min, max: w.max, fill: w.status ? STATUS_FILL[w.status] : '#737373',
    note: `${w.type}${w.inProgress ? ' · en cours' : w.future ? ' · à venir' : w.status ? ` · ${STATUS_WORD[w.status]}` : ''}` }))
const LOAD_LEGEND = 'Barre : charge de la semaine (RPE × durée, en UA). Fond gris : plage visée du type de semaine. Pointillé : cible. Vert : dans la plage, orange : sous-charge, rouge : surcharge.'

// La feuille : barre d'outils à l'écran seulement, puis la page A4
function Sheet({ fileName, title, subtitle, toolbar, children }: { fileName: string; title: string; subtitle: string; toolbar: ReactNode; children: ReactNode }) {
  // Le titre de l'onglet donne le nom du fichier (bouton ou Cmd+P) ; il est remis en quittant la feuille
  useEffect(() => { const before = document.title; document.title = fileName; return () => { document.title = before } }, [fileName])
  return (
    <div className="min-h-dvh bg-neutral-200 text-neutral-900 print:min-h-0 print:bg-white">
      {/* A4 pour cette feuille seulement : ailleurs dans l'app, le choix portrait / paysage reste libre */}
      <style>{'@page { size: A4; margin: 12mm } @media print { html, body { background: #fff !important } }'}</style>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-300 bg-white px-4 py-2 text-sm print:hidden">
        <Link to="/staff" className="font-semibold underline underline-offset-4">Retour à l'app</Link>
        {toolbar}
        <button type="button" onClick={() => window.print()}
          className="ml-auto min-h-11 rounded-lg bg-[#C8102E] px-4 font-display font-semibold text-white">Enregistrer en PDF</button>
        <p className="w-full text-xs text-neutral-600">Dans la fenêtre d'impression, choisis « Enregistrer au format PDF ». Fichier proposé : {fileName}.pdf. Ce document contient des données de santé : ne le partage qu'avec le staff.</p>
      </div>
      <main className="mx-auto my-4 flex w-[210mm] max-w-full flex-col gap-3 bg-white p-[12mm] font-sans text-xs leading-snug shadow print:m-0 print:w-auto print:p-0 print:shadow-none">
        <header className="flex items-end justify-between gap-4 border-b-2 border-[#C8102E] pb-2">
          <div><h1 className="font-display text-2xl font-semibold leading-tight">{title}</h1><p className="text-neutral-600">{subtitle}</p></div>
          <p className="shrink-0 text-right text-[10px] text-neutral-500">Pôle Espoir · Rouen Normandie Rugby<br />édité le {day(parisDate())}</p>
        </header>
        {children}
      </main>
    </div>
  )
}
const select = 'min-h-11 rounded-lg border border-neutral-400 bg-white px-2'
const Message = ({ children }: { children: ReactNode }) => <div className="min-h-dvh bg-white p-6 text-sm text-neutral-900">{children} <Link to="/staff" className="underline">Retour à l'app</Link></div>

export default function SummaryPage() {
  const [params, setParams] = useSearchParams()
  const ref = useReference()
  const roster = useRoster()
  if (ref.isPending || roster.isPending) return <Message><Loading /></Message>
  if (ref.isError || roster.isError) return <Message>Impossible de préparer le résumé.</Message>
  const today = parisDate()
  const allBlocks = blocksOf(ref.data.weeks)
  const blocks = allBlocks.filter(b => b.from <= today)
  const started = ref.data.weeks.filter(w => w.start_date <= today) // semaines commencées : les seules qu'on peut résumer
  if (!started.length) return <Message>Aucune semaine commencée au calendrier.</Message>
  const isStarted = (w: { code: string }) => started.some(x => x.code === w.code)

  const view = params.get('vue') === 'coach' ? 'coach' : 'joueur'
  const scope = params.get('sur') === 'cycle' ? 'cycle' : 'bloc'
  const current = blocks.find(b => b.block === Number(params.get('bloc'))) ?? blocks.find(b => b.to >= today) ?? blocks.at(-1)
  const cycles = [...new Set(blocks.map(b => b.cycle).filter((c): c is string => !!c))]
  const cycle = cycles.includes(params.get('cycle') ?? '') ? params.get('cycle')! : current?.cycle ?? cycles.at(-1) ?? null
  // Résumé du bloc : les semaines sont choisies ici (décision du 16/11/2026). Au départ, celles du bloc numéroté de la
  // semaine d'où l'on vient ; sans bloc numéroté, les 4 dernières semaines commencées.
  const asked = (params.get('semaines') ?? '').split(',')
  const picked = started.filter(w => asked.includes(w.code))
  const weeks = picked.length ? picked : current ? current.weeks.filter(w => isStarted(w)) : started.slice(-4)
  const block = chosenBlock(weeks, allBlocks)
  const chosen = scope === 'bloc' ? [block] : blocks.filter(b => b.cycle === cycle)
  const player = roster.data.find(p => p.id === params.get('joueur')) ?? roster.data[0]
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); p.set(k, v); setParams(p, { replace: true }) }
  const setWeeks = (codes: string[]) => set('semaines', codes.join(','))

  const toolbar = (
    <>
      <select aria-label="Résumé" value={view} onChange={e => set('vue', e.target.value)} className={select}><option value="joueur">Résumé d'un joueur</option><option value="coach">Résumé coach (collectif)</option></select>
      <select aria-label="Période" value={scope} onChange={e => set('sur', e.target.value)} className={select}><option value="bloc">Sur un bloc (semaines au choix)</option><option value="cycle" disabled={!cycles.length}>Sur un cycle</option></select>
      {scope === 'cycle' && <select aria-label="Cycle" value={cycle ?? ''} onChange={e => set('cycle', e.target.value)} className={select}>{cycles.map(c => <option key={c} value={c}>{c}</option>)}</select>}
      {view === 'joueur' && <select aria-label="Joueur" value={player?.id ?? ''} onChange={e => set('joueur', e.target.value)} className={select}>{roster.data.map(p => <option key={p.id} value={p.id}>{fullName(p)}</option>)}</select>}
      {scope === 'bloc' && (
        <fieldset className="flex w-full flex-wrap items-center gap-x-1 gap-y-1">
          <legend className="float-left mr-2 font-semibold">Semaines du bloc</legend>
          {started.map(w => {
            const on = weeks.includes(w)
            return (
              <label key={w.code} title={w.label ?? undefined} className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-300 px-2 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900">
                {/* la dernière semaine cochée ne se décoche pas : un résumé a toujours au moins une semaine */}
                <input type="checkbox" className="sr-only" checked={on} disabled={on && weeks.length === 1}
                  onChange={() => setWeeks((on ? weeks.filter(x => x !== w) : [...weeks, w]).map(x => x.code))} />
                {w.code}<span className="text-[10px] opacity-70">{w.week_type_code}</span>
              </label>
            )
          })}
          {blocks.length > 0 && (
            <select aria-label="Reprendre les semaines d'un bloc numéroté" value={block.label ? '' : block.block} className={`${select} ml-2`}
              onChange={e => { const b = blocks.find(x => x.block === Number(e.target.value)); if (b) setWeeks(b.weeks.filter(w => isStarted(w)).map(w => w.code)) }}>
              <option value="" disabled>Semaines choisies à la main</option>
              {blocks.map(b => <option key={b.block} value={b.block}>Reprendre le bloc {b.block} ({b.weeks[0].code} → {b.weeks.at(-1)!.code})</option>)}
            </select>
          )}
        </fieldset>
      )}
    </>
  )
  if (!chosen.length) return <Message>Aucun bloc dans ce cycle : donne un numéro de bloc aux semaines dans Programmation › Semaines.</Message>
  const safe = (text: string) => text.replace(/[^\p{L}\p{N}]+/gu, '-') // lettres accentuées gardées, rien d'interdit dans un nom de fichier
  const name = scope === 'cycle' ? safe(cycle ?? 'Sans-cycle').replace(/-/g, '') : block.label ? `Bloc_${safe(block.label.replace(' → ', '-'))}` : `Bloc${block.block}`
  const count = `${weeks.length} semaine${weeks.length > 1 ? 's' : ''}`
  const label = scope === 'cycle' ? `${cycle ?? 'Sans cycle'} · ${chosen.length} bloc${chosen.length > 1 ? 's' : ''}`
    : block.label ? `Semaines ${block.label} · ${count}` : `Bloc ${block.block}${block.cycle ? ` · bloc ${block.rank} du ${block.cycle}` : ''} · ${count}`
  const dates = period(chosen[0].from, chosen.at(-1)!.to)
  if (view === 'coach') return <CoachSheet key={name} blocks={chosen} label={label} dates={dates} fileName={`Coach_${name}_${chosen.at(-1)!.to.slice(0, 7)}`} toolbar={toolbar} />
  if (!player) return <Message>Aucun joueur.</Message>
  return <PlayerSheet key={`${name}-${player.id}`} playerId={player.id} blocks={chosen} allBlocks={allBlocks} previous={comparisonBlock(chosen[0], allBlocks, ref.data.weeks)}
    scope={scope} label={label} dates={dates} fileName={`${name}_${safe(`${player.last_name} ${player.first_name}`)}_${chosen.at(-1)!.to.slice(0, 7)}`} toolbar={toolbar} />
}

type SheetProps = { blocks: Block[]; label: string; dates: string; fileName: string; toolbar: ReactNode }

// previous : le point de comparaison du premier bloc (bloc numéroté d'avant, ou les semaines juste avant des semaines choisies)
function PlayerSheet({ playerId, blocks, allBlocks, previous, scope, label, dates, fileName, toolbar }: SheetProps & { playerId: string; allBlocks: Block[]; previous: Block | null; scope: 'bloc' | 'cycle' }) {
  const today = parisDate()
  const ref = useReference()
  const roster = useRoster()
  // semaines choisies pas forcément dans l'ordre du calendrier des blocs : on charge de la plus ancienne date à la plus récente
  const from = [previous?.from, ...blocks.map(b => b.from)].filter((d): d is string => !!d).sort()[0]
  const to = blocks.map(b => b.to).sort().at(-1)!
  const logs = useAllLogs(from, to, playerId)
  const wellness = useAllWellness(from, to, playerId)
  const muscu = useStaffMuscu(from, to, playerId)
  const injuries = useInjuryRecords()
  const matches = useMatches()
  const gps = useGpsRecords(playerId)
  const ratings = useRatings(playerId)
  const gpsRef = useGpsReference()
  const player = roster.data?.find(p => p.id === playerId)
  const title = `Résumé du ${scope} — ${player ? `${player.first_name} ${player.last_name}` : ''}`
  const subtitle = `${player?.position ?? 'Poste non renseigné'} · ${label} · ${dates}`
  const wrap = (children: ReactNode) => <Sheet fileName={fileName} title={title} subtitle={subtitle} toolbar={toolbar}>{children}</Sheet>
  // La charge suffit à ouvrir la feuille : une autre donnée qui ne se charge pas s'affiche « Non renseigné », l'export ne plante pas
  if (logs.isError || !ref.data || !player) return wrap(<p role="alert">Impossible de charger les données de ce joueur.</p>)
  if ([logs, wellness, muscu, injuries, matches, gps, ratings, gpsRef].some(q => q.isPending)) return wrap(<Loading />)

  const input = {
    player, weekTypes: ref.data.weekTypes, logs: logs.data ?? [], wellness: (wellness.data ?? []) as Wellness[], muscu: muscu.data ?? [],
    muscuTypeId: ref.data.types.find(t => t.name === MUSCULATION)?.id, matches: matches.data ?? [], gps: gps.data ?? [], ratings: ratings.data ?? [],
    gpsRef: gpsRef.data ?? { refs: new Map(), positions: new Map() }, injuries: (injuries.data ?? []).filter(i => i.player_id === playerId), today,
  }
  const failed = [[wellness, 'état de forme'], [muscu, 'musculation'], [injuries, 'blessures'], [matches, 'matchs'], [gps, 'GPS'], [ratings, 'notes de match']] as const
  const missing = failed.filter(([q]) => q.isError).map(([, l]) => l)
  const warning = missing.length > 0 && <p role="alert" className="rounded bg-amber-100 px-2 py-1 text-amber-900 [print-color-adjust:exact]">Données non chargées : {missing.join(', ')}. Elles apparaissent « {NR} ».</p>
  const all = scope === 'cycle' ? cycleSummary({ ...input, blocks, allBlocks }) : [blockSummary({ ...input, block: blocks[0], previous })]

  if (scope === 'cycle') {
    const injuriesAll = [...new Map(all.flatMap(b => b.injuries).map(i => [i.occurred_on, i])).values()]
    const col = (pick: (b: typeof all[number]) => string) => all.map(pick)
    return wrap(
      <>
        {warning}
        <Section title="Synthèse"><ul className="list-disc pl-4">{cycleHighlights(all).map(h => <li key={h}>{h}</li>)}</ul></Section>
        <Section title="Charge moyenne par semaine, bloc par bloc (RPE × durée)">
          <Bars unit=" UA" items={all.map(b => ({ label: `Bloc ${b.block.block}`, value: b.perWeek, note: `${b.block.weeks[0].code} → ${b.block.weeks.at(-1)!.code}${b.inProgress ? ' · en cours' : ''}` }))} />
        </Section>
        <Section title="Charge totale, bloc par bloc">
          <Bars unit=" UA" items={all.map(b => ({ label: `Bloc ${b.block.block}`, value: b.total, note: `${b.block.weeks.length} semaine${b.block.weeks.length > 1 ? 's' : ''}${b.inProgress ? ' · en cours' : ''}` }))} />
        </Section>
        <Section title="Charge semaine par semaine">
          <Bars items={weekBars(all.flatMap(b => b.weekly))} />
          <p className="text-[10px] text-neutral-500">{LOAD_LEGEND}</p>
        </Section>
        <Section title="Fatigue moyenne par bloc (état de forme)">
          {all.some(b => b.wellness.fatigue !== null) ? <Bars unit=" %" items={all.map(b => ({ label: `Bloc ${b.block.block}`, value: b.wellness.fatigue, note: `${b.wellness.alerts.length} alerte${b.wellness.alerts.length > 1 ? 's' : ''}` }))} /> : <Empty />}
        </Section>
        <Section title="Évolution bloc par bloc">
          <Table head={['', ...all.map(b => `Bloc ${b.block.block}`)]} rows={[
            ['Charge totale (UA)', ...col(b => n(b.total))],
            ['Évolution du total face au bloc précédent', ...col(b => signed(b.totalChangePct))],
            ['Charge moyenne par semaine (UA)', ...col(b => n(b.perWeek))],
            ['Évolution de la moyenne face au bloc précédent', ...col(b => signed(b.changePct))],
            ['Semaines hors plage', ...col(b => (b.weekly.some(w => w.status) ? String(b.weekly.filter(w => w.status && w.status !== 'conforme').length) : NR))],
            ['Fatigue moyenne', ...col(b => n(b.wellness.fatigue, ' %'))],
            ['Alertes d\'état de forme', ...col(b => (b.wellness.entries ? String(b.wellness.alerts.length) : NR))],
            ['Musculation : séances faites / prévues', ...col(b => (b.muscu.planned ? `${b.muscu.attended} / ${b.muscu.planned} (${b.muscu.rate} %)` : NR))],
            ['Exercices faits', ...col(b => (b.muscu.exercises ? `${b.muscu.completionPct} %` : NR))],
            ['Matchs joués (GPS)', ...col(b => (b.notes.length ? `${b.gps.played} / ${b.notes.length}` : NR))],
            ['Distance moyenne (m)', ...col(b => n(b.gps.distance))],
            ['Attendus GPS remplis (sur 3)', ...col(b => n(b.gps.meanFilled))],
            ['Jours d\'arrêt dans le bloc (blessure)', ...col(b => String(b.injuries.reduce((s, i) => s + i.daysIn, 0)))],
          ]} />
        </Section>
        <Section title="Blessures du cycle"><Injuries items={injuriesAll} /></Section>
      </>,
    )
  }

  const b = all[0]
  return wrap(
    <>
      {warning}
      {b.inProgress && <p className="text-neutral-600">Bloc en cours : chiffres arrêtés au {day(today)}</p>}
      <Section title="Synthèse"><ul className="list-disc pl-4">{b.highlights.map(h => <li key={h}>{h}</li>)}</ul></Section>
      <Section title="Charge (RPE × durée)">
        <Figures items={[
          ['Total du bloc', n(b.total, ' UA'), previous ? `${signed(b.totalChangePct)} face à ${previous.label ?? blockName(previous)} (${n(b.previousTotal)} UA)` : 'pas de période précédente'],
          ['Moyenne par semaine', n(b.perWeek, ' UA'), // semaines terminées
          previous ? `${signed(b.changePct)} face à ${previous.label ?? blockName(previous)} (${n(b.previousPerWeek)} UA)` : 'pas de période précédente'],
          ['Semaines de match', n(b.work, ' UA'), 'moyenne par semaine terminée'],
          ['Semaine de repos', n(b.rest, ' UA'), b.rest !== null && b.work ? `${Math.round((100 * b.rest) / b.work)} % d'une semaine de match` : undefined],
        ]} />
        <Bars items={weekBars(b.weekly)} />
        <p className="text-[10px] text-neutral-500">{LOAD_LEGEND}</p>
      </Section>
      <Section title="Matchs et GPS">
        {!b.notes.length ? <Empty>Aucun match sur ce bloc.</Empty> : (
          <>
            <Table left={[0, 7, 8]} head={['Match', 'Temps de jeu', 'Distance (m)', 'Haute intensité (m)', 'Accélérations', 'Vmax (km/h)', 'Attendus GPS', 'Note du staff', 'Note du joueur']}
              rows={[...b.notes.map(m => {
                const h = b.gps.history.find(x => x.match.id === m.match.id)
                return [`${day(m.match.match_date)} · ${m.match.label ? `${m.match.label} ` : ''}${m.match.opponent}`, n(m.minutes, ' min'), n(h?.record?.distance_m), n(h?.record?.hi_distance_m),
                  n(h?.record?.accelerations), n(h?.record?.vmax), h?.analysis ? `${h.analysis.filled} / 3` : NR, m.staff ? RATING_LABEL[m.staff] : NR, m.player ? RATING_LABEL[m.player] : NR]
              }), ...(b.gps.played ? [[<b key="m">Moyenne du bloc</b>, n(b.gps.minutes, ' min'), n(b.gps.distance), n(b.gps.hi), n(b.gps.accelerations), n(b.gps.vmaxMax), n(b.gps.meanFilled), '', '']] : [])]} />
            {b.gps.axis && <p className="mt-1 text-neutral-600">Axe de travail : {b.gps.axis.toLowerCase()}, l'attendu le moins atteint. Vmax : la meilleure du bloc.</p>}
          </>
        )}
      </Section>
      <Section title="Musculation">
        {!b.muscu.planned ? <Empty>Aucune séance de musculation échue sur ce bloc.</Empty> : (
          <Figures items={[
            ['Présences', b.muscu.rate === null ? NR : `${b.muscu.rate} %`, `${b.muscu.attended} séance${b.muscu.attended > 1 ? 's' : ''} faite${b.muscu.attended > 1 ? 's' : ''} sur ${b.muscu.planned} prévue${b.muscu.planned > 1 ? 's' : ''}`],
            ['Exercices faits', `${b.muscu.completionPct} %`, `${b.muscu.exercises} exercices prévus`],
            ['Charges validées', `${b.muscu.respected}`, `respectées · ${b.muscu.partial} partielles · ${b.muscu.notRespected} non respectées`],
            ['RPE moyen de séance', n(b.muscu.sessionRpe), b.muscu.hardest ? `le plus dur : ${b.muscu.hardest.name} (RPE ${b.muscu.hardest.rpe})` : undefined],
          ]} />
        )}
      </Section>
      <Section title="État de forme">
        {!b.wellness.entries ? <Empty /> : (
          <>
            <Figures items={[
              ['Fatigue moyenne', n(b.wellness.fatigue, ' %'), `${b.wellness.entries} jour${b.wellness.entries > 1 ? 's' : ''} rempli${b.wellness.entries > 1 ? 's' : ''}`],
              ['Alertes', String(b.wellness.alerts.length), 'score sous 16/30 ou un item à 1'],
            ]} />
            {b.wellness.zones.length > 0 && <p>Zones concernées : {b.wellness.zones.map(z => `${z.label.toLowerCase()} × ${z.count}`).join(', ')}.</p>}
            {b.wellness.alerts.length > 0 && <p className="text-neutral-600">{b.wellness.alerts.map(a => `${day(a.date)} (${a.reasons.join(', ')})`).join(' · ')}</p>}
          </>
        )}
      </Section>
      <Section title="Blessures"><Injuries items={b.injuries} /></Section>
    </>,
  )
}

function Injuries({ items, withName = false }: { items: { name?: string; occurred_on: string; what: string | null; context: string | null; days: number; daysIn: number; ongoing: boolean; recurrence: boolean }[]; withName?: boolean }) {
  if (!items.length) return <Empty>Aucune blessure sur la période.</Empty>
  return <Table left={withName ? [0, 1, 2, 3, 5] : [0, 1, 2, 4]} head={[...(withName ? ['Joueur'] : []), 'Date', 'Blessure', 'Contexte', 'Jours d\'arrêt', 'Statut']}
    rows={items.map(i => [...(withName ? [i.name ?? ''] : []), day(i.occurred_on), `${i.what ?? NR}${i.recurrence ? ' (récidive)' : ''}`, i.context ?? NR, String(i.days), i.ongoing ? 'en cours' : 'terminée'])} />
}

function CoachSheet({ blocks, label, dates, fileName, toolbar }: SheetProps) {
  const today = parisDate()
  const isAdmin = useIsAdmin()
  const ref = useReference()
  const roster = useRoster()
  const from = blocks[0].from
  const to = blocks.at(-1)!.to
  const logs = useAllLogs(addDays(from, -35), to) // 35 jours avant : le ratio aigu / chronique regarde 16 jours d'entraînement en arrière
  const wellness = useAllWellness(from, to)
  const plan = useAllPlan(from, to)
  const skips = useAllSkips(from, to)
  const muscu = useStaffMuscu(from, to)
  const injuries = useInjuryRecords()
  const title = 'Résumé coach'
  const wrap = (children: ReactNode) => <Sheet fileName={fileName} title={title} subtitle={`${label} · ${dates}`} toolbar={toolbar}>{children}</Sheet>
  if (logs.isError || !ref.data || !roster.data) return wrap(<p role="alert">Impossible de charger les données du groupe.</p>)
  if ([logs, wellness, plan, skips, muscu, injuries].some(q => q.isPending)) return wrap(<Loading />)
  const missing = ([[wellness, 'état de forme'], [plan, 'planning'], [muscu, 'musculation'], [injuries, 'blessures']] as const).filter(([q]) => q.isError).map(([, l]) => l)

  const r = coachSummary({
    players: roster.data, weeks: blocks.flatMap(b => b.weeks), weekTypes: ref.data.weekTypes, logs: logs.data ?? [], wellness: (wellness.data ?? []) as Wellness[],
    plan: (plan.data ?? []) as PlanItem[], skips: (skips.data ?? []) as Skip[], types: ref.data.types, muscu: muscu.data ?? [],
    muscuTypeId: ref.data.types.find(t => t.name === MUSCULATION)?.id, injuries: injuries.data ?? [], withRatio: isAdmin, today,
  })
  const outside = r.team.filter(w => w.over.length || w.under.length)
  const ZONE: Record<string, Tone> = { bas: 'warn', optimal: 'ok', vigilance: 'warn', risque: 'bad' }
  return wrap(
    <>
      {missing.length > 0 && <p role="alert" className="rounded bg-amber-100 px-2 py-1 text-amber-900 [print-color-adjust:exact]">Données non chargées : {missing.join(', ')}. Elles apparaissent « {NR} ».</p>}
      {r.inProgress && <p className="text-neutral-600">Période en cours : chiffres arrêtés au {day(today)}</p>}
      <Section title="En un coup d'œil">
        <Figures items={[
          ['Semaines dans la plage', r.team.some(w => w.status) ? `${r.team.filter(w => w.status === 'conforme').length} / ${r.team.filter(w => w.status).length}` : NR, 'charge moyenne de l\'équipe'],
          ['Présences équipe', n(r.attendance, ' %'), 'activités prévues et déclarées'],
          ['Présences musculation', n(r.muscu, ' %'), 'séances prévues et faites'],
          ['Alertes · blessés', `${r.alerts.length} · ${new Set(r.injuries.map(i => i.player_id)).size}`, 'état de forme · joueurs blessés'],
        ]} />
      </Section>
      <Section title="Charge de travail : moyenne de l'équipe par semaine (RPE × durée)">
        <Bars items={weekBars(r.team)} />
        <p className="text-[10px] text-neutral-500">{LOAD_LEGEND} Joueurs blessés sur la période exclus de la moyenne.</p>
        {outside.length > 0 && <ul className="mt-1">{outside.map(w => (
          <li key={w.code}><b>{w.code}</b>{w.over.length > 0 && <> · au-dessus de la plage : {w.over.join(', ')}</>}{w.under.length > 0 && <> · en dessous : {w.under.join(', ')}</>}</li>
        ))}</ul>}
      </Section>
      <Section title="Récapitulatif par joueur">
        <Table head={['Joueur', 'Charge totale (UA)', 'Semaines hors plage', 'Alertes', 'Présences', 'Musculation', ...(isAdmin ? ['Ratio aigu / chronique'] : [])]}
          rows={r.rows.map(x => [
            <span key="n" className="whitespace-nowrap"><span aria-hidden="true" className={`mr-1.5 inline-block size-2 rounded-full [print-color-adjust:exact] ${{ ok: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-red-600', neutral: 'bg-neutral-300' }[x.worst]}`} />{fullName(x.player)}{x.injured && <span className="text-neutral-500"> · blessé</span>}</span>,
            n(x.total),
            x.injured ? <span className="text-neutral-500">blessé</span> : <Cell tone={x.tones.load}>{x.weekly.some(w => w.status) ? `${x.over + x.under}${x.over ? ` · ${x.over} ↑` : ''}${x.under ? ` · ${x.under} ↓` : ''}` : NR}</Cell>,
            <Cell key="a" tone={x.tones.alerts}>{x.alerts ?? NR}</Cell>,
            <Cell key="p" tone={x.tones.attendance}>{x.attendance === null ? NR : `${x.attendance} %`}</Cell>,
            <Cell key="m" tone={x.tones.muscu}>{x.muscu === null ? NR : `${x.muscu} %`}</Cell>,
            ...(isAdmin ? [x.ratio?.ratio != null ? <Cell key="r" tone={ZONE[x.ratio.zone ?? ''] ?? 'neutral'}>{x.ratio.ratio.toLocaleString('fr-FR')}</Cell> : NR] : []),
          ])} />
        <p className="mt-1 break-inside-avoid text-[10px] text-neutral-500">
          Pastille : la couleur la plus sévère de la ligne. Semaines hors plage : orange dès {SUMMARY.weeksOutOfRange.warn}, rouge dès {SUMMARY.weeksOutOfRange.bad} (↑ surcharge, ↓ sous-charge).
          Alertes : orange dès {SUMMARY.alerts.warn}, rouge dès {SUMMARY.alerts.bad}. Présences et musculation : vert à partir de {SUMMARY.attendance.ok} %, orange à partir de {SUMMARY.attendance.warn} %.
          {isAdmin && ' Ratio aigu / chronique à la fin de la période : vert de 0,8 à 1,3 ; rouge au-delà de 1,5 (colonne réservée aux admins).'}
        </p>
      </Section>
      <Section title="Alertes d'état de forme">
        {!r.alerts.length ? <Empty>Aucune alerte sur la période.</Empty>
          : <Table left={[0, 2, 3]} head={['Joueur', 'Alertes', 'Zones concernées', 'Dates']} rows={[...new Set(r.alerts.map(a => a.name))].map(name => {
            const own = r.alerts.filter(a => a.name === name)
            // « Stress à 1 » compté par zone ; le score global bas n'est pas une zone
            const zones = own.flatMap(a => a.reasons.filter(x => !x.startsWith('Score')).map(x => x.replace(' à 1', '')))
            const counted = [...new Set(zones)].map(z => `${z.toLowerCase()} × ${zones.filter(x => x === z).length}`)
            return [name, String(own.length), counted.join(', ') || 'score global bas', own.map(a => day(a.date)).join(', ')]
          })} />}
      </Section>
      <Section title="Blessés"><Injuries items={r.injuries} withName /></Section>
    </>,
  )
}

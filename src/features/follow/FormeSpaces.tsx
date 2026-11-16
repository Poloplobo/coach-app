import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Apple, ChevronRight, HeartPulse, Moon } from 'lucide-react'
import { addDays } from '../../lib/week'
import { useEnrollments, useGoals } from './useFollow'
import { useSleepEntries } from './useSleep'
import { useHydration, useMealItems } from './useNutrition'
import { TARGET_MIN, hm, sleepStats } from './sleep'
import { WATER_TARGET_ML, litres } from './nutrition'
import { nutritionWeek } from './nutritionWeek'

const FollowSection = lazy(() => import('./FollowSection'))
const SleepToday = lazy(() => import('./SleepModule'))

// Les modules qui ont leur propre volet dans l'onglet ; les autres restent dans le volet Forme
const TABBED = ['sommeil', 'nutrition'] as const
type Space = 'forme' | (typeof TABBED)[number]
const SPACES: Record<Space, { label: string; icon: typeof Moon }> = {
  forme: { label: 'Forme', icon: HeartPulse }, sommeil: { label: 'Sommeil', icon: Moon }, nutrition: { label: 'Nutrition', icon: Apple },
}
const dayLetter = (d: string) => 'DLMMJVS'[new Date(`${d}T12:00:00Z`).getUTCDay()]

// Onglet Forme quand le suivi individuel est ouvert (drapeau) : un volet Forme, plus un volet par module actif (sommeil,
// nutrition), chacun dans son ambiance (bleu nuit, vert). wellness : la carte d'état de forme, inchangée.
export default function FormeSpaces({ playerId, today, filled, wellness }: { playerId: string; today: string; filled: boolean; wellness: ReactNode }) {
  const enrollments = useEnrollments(playerId)
  const goals = useGoals(playerId)
  const [space, setSpace] = useState<Space>('forme')
  const active = (code: string) => enrollments.data?.find(e => e.module_code === code && e.status === 'actif')
  // Module prêt (consenti, objectif en cours) : le volet montre le bilan ; sinon seulement l'étape où en est le joueur
  const ready = (code: string) => { const e = active(code); return !!e?.consented_at && !!goals.data?.some(g => g.enrollment_id === e.id && g.status === 'en_cours') }
  const spaces: Space[] = ['forme', ...TABBED.filter(c => active(c))]
  const current = spaces.includes(space) ? space : 'forme'

  return (
    <>
      {spaces.length > 1 && (
        <div role="tablist" aria-label="Ma forme" className={`grid gap-1 rounded-2xl bg-field p-1 ${spaces.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {spaces.map(s => {
            const { label, icon: Icon } = SPACES[s]
            return (
              <button key={s} id={`forme-${s}`} type="button" role="tab" aria-selected={current === s} aria-controls="forme-pane" onClick={() => setSpace(s)}
                className={`flex h-11 items-center justify-center gap-1.5 rounded-xl font-display text-sm font-semibold uppercase tracking-wider transition-colors ${
                  current === s ? 'bg-surface text-ink shadow-sm ring-1 ring-line/60' : 'text-ink/55'}`}>
                <Icon size={15} aria-hidden="true" />{label}
              </button>
            )
          })}
        </div>
      )}
      <div id="forme-pane" role={spaces.length > 1 ? 'tabpanel' : undefined} aria-labelledby={spaces.length > 1 ? `forme-${current}` : undefined} key={current} className="flex flex-col gap-6">
        <Suspense fallback={null}>
          {current === 'forme' && <>
            {/* La nuit se saisit juste après l'état de forme : un raccourci vers le volet Sommeil tant qu'elle ne l'est pas */}
            {filled && ready('sommeil') && <NightPrompt playerId={playerId} today={today} onOpen={() => setSpace('sommeil')} />}
            {wellness}
            <FollowSection playerId={playerId} today={today} except={spaces.filter(s => s !== 'forme')} />
          </>}
          {current === 'sommeil' && (
            <Ambiance kind="nuit" title="Mon sommeil" logo={<NightLogo />}>
              {/* La nuit à saisir d'abord (tant qu'elle ne l'est pas), puis le retour sur la nuit et la semaine */}
              {filled ? <SleepToday playerId={playerId} today={today} />
                : ready('sommeil') && <p className="rounded-xl bg-surface px-4 py-3 text-sm ring-1 ring-line/60">Remplis d'abord ton état de forme (volet Forme) : ta nuit se saisit juste après.</p>}
              {ready('sommeil') && <SleepReport playerId={playerId} today={today} />}
              <FollowSection playerId={playerId} today={today} only="sommeil" />
            </Ambiance>
          )}
          {current === 'nutrition' && (
            <Ambiance kind="nutrition" title="Ma nutrition" logo={<FoodLogo />}>
              {ready('nutrition') && <NutritionReport playerId={playerId} today={today} />}
              <FollowSection playerId={playerId} today={today} only="nutrition" />
            </Ambiance>
          )}
        </Suspense>
      </div>
    </>
  )
}

// Volet immersif : ses propres couleurs (variables du thème redéfinies, index.css) sur toute la largeur, logo animé en tête
function Ambiance({ kind, title, logo, children }: { kind: 'nuit' | 'nutrition'; title: string; logo: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className={`ambiance-${kind} -mx-4 flex flex-col gap-5 rounded-t-[2rem] bg-app px-4 pb-10 pt-6 text-ink`}>
      <header className="flex items-center gap-4">
        {logo}
        <h2 className="font-display text-3xl font-semibold leading-tight">{title}</h2>
      </header>
      {children}
    </section>
  )
}

// Lune qui se lève et étoiles qui scintillent, deux fois puis immobiles (rien pendant la saisie, rien si moins d'animations)
function NightLogo() {
  return (
    <svg viewBox="0 0 64 64" className="amb-logo h-16 w-16 shrink-0" aria-hidden="true">
      <path className="amb-moon" d="M40 10a22 22 0 1 0 14 34A18 18 0 0 1 40 10z" fill="rgb(var(--gold))" />
      {[[14, 14, 2.2, 0], [52, 18, 1.6, 0.4], [10, 40, 1.4, 0.8], [56, 52, 1.8, 1.2]].map(([x, y, r, d]) => (
        <circle key={`${x}-${y}`} className="amb-star" cx={x} cy={y} r={r} fill="currentColor" style={{ animationDelay: `${d}s` }} />
      ))}
    </svg>
  )
}

// Bol dont la vapeur monte, deux fois puis immobile
function FoodLogo() {
  return (
    <svg viewBox="0 0 64 64" className="amb-logo h-16 w-16 shrink-0" aria-hidden="true">
      {[22, 32, 42].map((x, i) => (
        <path key={x} className="amb-steam" d={`M${x} 26c-4-4 4-8 0-12`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animationDelay: `${i * 0.25}s` }} />
      ))}
      <path d="M8 32h48a24 18 0 0 1-48 0z" className="fill-ok" />
      <path d="M22 54h20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

// Raccourci du volet Forme vers la saisie de la nuit, tant qu'elle n'est pas faite
function NightPrompt({ playerId, today, onOpen }: { playerId: string; today: string; onOpen: () => void }) {
  const entries = useSleepEntries(playerId, addDays(today, -14)) // même requête que le module : servie par le cache
  if (!entries.data || entries.data.some(e => e.night_date === today)) return null
  return (
    <button type="button" onClick={onOpen} className="ambiance-nuit flex min-h-14 items-center gap-3 rounded-2xl bg-app px-4 py-3 text-left text-ink">
      <Moon size={22} aria-hidden="true" className="shrink-0 text-gold" />
      <span className="flex-1"><span className="block font-semibold">Ta nuit t'attend</span><span className="text-sm text-ink/70">Quelques touches dans le volet Sommeil</span></span>
      <ChevronRight size={20} aria-hidden="true" />
    </button>
  )
}

// Retour sur la nuit dernière et les 7 dernières, face au repère de 8 h (le détail reste dans le module)
function SleepReport({ playerId, today }: { playerId: string; today: string }) {
  const entries = useSleepEntries(playerId, addDays(today, -14))
  if (!entries.data) return null
  const night = entries.data.find(e => e.night_date === today)
  const stats = sleepStats(entries.data, today)
  const gap = night ? night.duration_min - TARGET_MIN : null
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex flex-col rounded-2xl bg-surface p-4 ring-1 ring-line/60">
        <span className="text-xs text-ink/60">Cette nuit</span>
        <span className="font-display text-3xl font-semibold leading-tight tabular-nums">{night ? hm(night.duration_min) : '—'}</span>
        <span className={`text-xs ${gap === null ? 'text-ink/60' : gap >= 0 ? 'font-semibold text-ok' : 'text-ink/70'}`}>
          {gap === null ? 'pas encore saisie' : gap >= 0 ? 'repère de 8 h atteint' : `${hm(-gap)} sous le repère de 8 h`}
        </span>
      </div>
      <div className="flex flex-col rounded-2xl bg-surface p-4 ring-1 ring-line/60">
        <span className="text-xs text-ink/60">7 dernières nuits</span>
        <span className="font-display text-3xl font-semibold leading-tight tabular-nums">{stats ? hm(stats.average) : '—'}</span>
        <span className="text-xs text-ink/70">{stats ? `en moyenne · ${stats.nights} nuit${stats.nights > 1 ? 's' : ''} saisie${stats.nights > 1 ? 's' : ''}` : 'aucune nuit saisie'}</span>
      </div>
    </div>
  )
}

// Retour sur la veille et les 7 derniers jours : repas principaux, repas complets, eau, face aux repères (jamais de calories)
function NutritionReport({ playerId, today }: { playerId: string; today: string }) {
  const items = useMealItems(playerId, addDays(today, -14)) // mêmes requêtes que le module : servies par le cache
  const water = useHydration(playerId, addDays(today, -14))
  if (!items.data || !water.data) return null
  const w = nutritionWeek(items.data, water.data, today)
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line/60">
      <p className="text-sm"><span className="font-semibold">Hier</span> <span className="text-ink/70">· {w.yesterday.mainMeals}/3 repas · {w.yesterday.complete}/2 complets · {litres(w.yesterday.ml)} d'eau</span></p>
      {/* Une colonne par jour : trois points pour les repas (plein si saisi), la barre d'eau face au repère de 2 L */}
      <ol className="grid grid-cols-7 gap-1.5" aria-label="Mes 7 derniers jours">
        {w.days.map(d => (
          <li key={d.day} className="flex flex-col items-center gap-1" aria-label={`${d.day} : ${d.mainMeals} repas sur 3, ${d.complete} complets, ${litres(d.ml)} d'eau`}>
            <span aria-hidden="true" className="flex gap-0.5">
              {[0, 1, 2].map(i => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < d.mainMeals ? 'bg-ok' : 'bg-ink/20'}`} />)}
            </span>
            <span aria-hidden="true" className="relative flex h-12 w-full items-end justify-center rounded-md bg-field">
              <span className="absolute inset-x-0 border-t border-dashed border-ink/40" style={{ bottom: '80%' }} />
              {d.ml > 0 && <span className={`w-1/2 rounded-sm ${d.ml >= WATER_TARGET_ML ? 'bg-ok' : 'bg-ink/50'}`} style={{ height: `${Math.min(100, Math.max(6, (80 * d.ml) / WATER_TARGET_ML))}%` }} />}
            </span>
            <span aria-hidden="true" className={`font-display text-xs font-semibold ${d.complete === 2 ? 'text-ok' : 'text-ink/60'}`}>{dayLetter(d.day)}</span>
          </li>
        ))}
      </ol>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div><dt className="text-[11px] text-ink/60">Repas saisis</dt><dd className="font-display text-xl font-semibold tabular-nums">{w.meals.done}<span className="text-sm text-ink/50">/{w.meals.of}</span></dd></div>
        <div><dt className="text-[11px] text-ink/60">Repas complets</dt><dd className="font-display text-xl font-semibold tabular-nums">{w.complete.done}<span className="text-sm text-ink/50">/{w.complete.of}</span></dd></div>
        <div><dt className="text-[11px] text-ink/60">Eau par jour</dt><dd className="font-display text-xl font-semibold tabular-nums">{litres(w.waterAvg)}</dd></div>
      </dl>
      <p className="text-xs text-ink/60">Repères : 3 repas par jour, déjeuner et dîner complets (protéine, féculent, légume), {litres(WATER_TARGET_ML)} d'eau (trait).</p>
    </div>
  )
}

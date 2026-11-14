import { useDeferredValue, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Loading } from '../../components/ui/Loading'
import { addDays } from '../../lib/week'
import { Chips, Tile } from './SleepModule'
import { CATEGORIES, COURSES, MEALS, PORTIONS, WATER_TARGET_ML, dayStats, defaultUnit, gramsOf, hasCourses, intake, litres, mealParts, parseQuantity, type Meal } from './nutrition'
import { useAddFood, useAddMealItem, useAddWater, useDeleteMealItem, useDeleteWater, useFoodSearch, useHydration, useMealItems, useMealItemsWithNutrients, type Food, type MealItem } from './useNutrition'

const field = 'min-h-11 rounded-lg border border-line bg-field px-3 py-2 text-base'
const HISTORY = 14 // jours chargés : le journal du staff et les aliments récents du joueur
const WATER = [[250, 'Verre'], [500, 'Bouteille'], [750, 'Gourde']] as const
const PART_LABEL = { proteine: 'Protéine', feculent: 'Féculent', legume: 'Légume' }
const longDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(/^./, c => c.toUpperCase())
// « 150 g », mais « 2 × tranche » : pas d'accord au pluriel à gérer
const qty = (i: { quantity: number; unit: string }) => `${Number(i.quantity).toLocaleString('fr-FR')}\u00a0${['g', 'kg', 'mL', 'L'].includes(i.unit) ? '' : '×\u00a0'}${i.unit}`

// Ajout d'un aliment à un repas : recherche (ou récents), puis quantité. On reste ouvert pour enchaîner plusieurs aliments.
function AddFood({ playerId, day, meal, recents, onClose }: { playerId: string; day: string; meal: Meal; recents: Food[]; onClose: () => void }) {
  const add = useAddMealItem(playerId)
  const create = useAddFood(playerId)
  const [term, setTerm] = useState('')
  const [picked, setPicked] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('portion moyenne')
  const [course, setCourse] = useState<string>('plat')
  const [category, setCategory] = useState<string | null>(null) // non nul : création d'un aliment personnel
  const search = useFoodSearch(useDeferredValue(term))
  const typed = term.trim().length >= 2
  const list = typed ? search.data ?? [] : recents
  const pick = (f: Food) => { setPicked(f); setUnit(defaultUnit(f.category)); setQuantity('1'); setCategory(null) }
  const grams = gramsOf(parseQuantity(quantity), unit)
  const valid = grams > 0 && grams <= 5000

  if (picked) return (
    <form className="flex flex-col gap-3 rounded-xl bg-field p-3" onSubmit={e => {
      e.preventDefault()
      if (valid) add.mutate({ day, meal, course: hasCourses(meal) ? course : null, food_id: picked.id, quantity: parseQuantity(quantity), unit, grams },
        { onSuccess: () => { setPicked(null); setTerm('') } })
    }}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">{picked.name}</p>
        <Button type="button" variant="quiet" onClick={() => setPicked(null)}>Changer</Button>
      </div>
      <div className="grid grid-cols-[5.5rem_1fr] gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink/60">Quantité
          <input inputMode="decimal" autoFocus value={quantity} onChange={e => setQuantity(e.target.value)} className={`${field} text-center tabular-nums text-ink`} /></label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-ink/60">Unité
          <select value={unit} onChange={e => setUnit(e.target.value)} className={`${field} text-ink`}>
            {PORTIONS.map(([u, g]) => <option key={u} value={u}>{g === 1 || g === 1000 ? u : `${u} (≈ ${g} g)`}</option>)}
          </select></label>
      </div>
      {hasCourses(meal) && <Chips label="C'est mon" value={course} options={COURSES} onChange={setCourse} />}
      {!valid && quantity !== '' && <p role="alert" className="text-sm text-rnr">Quantité entre 1 g et 5 kg.</p>}
      {add.isError && <p role="alert" className="text-sm text-rnr">Enregistrement impossible, réessaie.</p>}
      <Button type="submit" disabled={!valid || add.isPending}>Ajouter au repas</Button>
    </form>
  )
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-field p-3">
      <div className="flex gap-2">
        <input type="search" autoFocus value={term} onChange={e => { setTerm(e.target.value); setCategory(null) }} maxLength={50}
          placeholder="Chercher un aliment" aria-label="Chercher un aliment" className={`${field} min-w-0 flex-1 bg-surface`} />
        <Button type="button" variant="ghost" onClick={onClose}>Terminer</Button>
      </div>
      {!typed && recents.length > 0 && <p className="text-xs text-ink/60">Mes aliments récents</p>}
      {search.isError && typed && <p role="alert" className="text-sm text-rnr">Recherche impossible. Vérifie ta connexion.</p>}
      <ul className="flex flex-col">
        {list.map(f => (
          <li key={f.id} className="border-t border-line/60 first:border-t-0">
            <button type="button" onClick={() => pick(f)} className="flex min-h-11 w-full items-center py-1.5 text-left text-sm [overflow-wrap:anywhere]">{f.name}</button>
          </li>
        ))}
      </ul>
      {typed && search.isSuccess && (category === null
        ? <Button type="button" variant="quiet" className="self-start text-left leading-snug [overflow-wrap:anywhere]" onClick={() => setCategory('autre')}>
            {list.length ? 'Je ne trouve pas' : 'Aucun aliment trouvé'} : ajouter « {term.trim()} »</Button>
        : (
          <div className="flex flex-col gap-2 border-t border-line/60 pt-2">
            <label className="flex flex-col gap-1 text-xs text-ink/60 [overflow-wrap:anywhere]">« {term.trim()} », c'est plutôt
              <select value={category} onChange={e => setCategory(e.target.value)} className={`${field} bg-surface text-ink`}>
                {CATEGORIES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
              </select></label>
            {create.isError && <p role="alert" className="text-sm text-rnr">Ajout impossible, réessaie.</p>}
            <Button type="button" variant="ghost" disabled={create.isPending} onClick={() => create.mutate({ name: term, category }, { onSuccess: pick })}>Ajouter cet aliment</Button>
          </div>
        ))}
    </div>
  )
}

// Le module nutrition dans sa carte : le bilan du jour, l'eau, puis le journal repas par repas.
// staff : lecture seule, avec les apports estimés (jamais montrés au joueur).
export function NutritionModule({ playerId, today, staff = false }: { playerId: string; today: string; staff?: boolean }) {
  const from = addDays(today, -HISTORY)
  const items = useMealItems(playerId, from)
  const water = useHydration(playerId, from)
  const nutrients = useMealItemsWithNutrients(playerId, from, staff)
  const addWater = useAddWater(playerId)
  const delWater = useDeleteWater()
  const delItem = useDeleteMealItem()
  const [day, setDay] = useState(today)
  const [adding, setAdding] = useState<Meal | null>(null)
  if (items.isPending || water.isPending) return <Loading />
  if (items.isError || water.isError) return <p role="alert" className="text-sm">Impossible de charger le journal.</p>

  const dayItems = items.data.filter(i => i.day === day)
  const stats = dayStats(items.data, day)
  const drunk = water.data.filter(w => w.day === day)
  const ml = drunk.reduce((s, w) => s + w.ml, 0)
  // Récents : les derniers aliments saisis, sans doublon
  const recents = [...new Map([...items.data].reverse().flatMap(i => (i.food ? [[i.food.id, i.food] as const] : []))).values()].slice(0, 8)
  const est = staff && nutrients.data ? intake(dayItems.map(i => ({ grams: i.grams, nutrients: [nutrients.data.find(n => n.id === i.id)?.food?.nutrients ?? null].flat()[0] ?? null }))) : null

  return (
    <div className="flex flex-col gap-4">
      {staff ? (
        <label className="flex flex-col gap-1 text-xs text-ink/60">Journée
          <select value={day} onChange={e => setDay(e.target.value)} className={`${field} text-ink`}>
            {Array.from({ length: HISTORY }, (_, i) => addDays(today, -i)).map(d => <option key={d} value={d}>{longDay(d)}</option>)}
          </select></label>
      ) : <Chips label="Mon journal" value={day} options={[[today, 'Aujourd\'hui'], [addDays(today, -1), 'Hier']]} onChange={d => { setDay(d); setAdding(null) }} />}

      <dl className="grid grid-cols-3 gap-2">
        <Tile label="Repas" value={<>{stats.mainMeals}<span className="text-base text-ink/60"> / 3</span></>} sub="principaux saisis" />
        <Tile label="Complets" value={<>{stats.complete}<span className="text-base text-ink/60"> / 2</span></>} sub="déjeuner et dîner" />
        <Tile label="Eau" value={<span className="text-xl">{litres(ml)}</span>} sub={`repère ${litres(WATER_TARGET_ML)}`} />
      </dl>
      {staff && nutrients.isError && <p role="alert" className="text-sm">Impossible de charger les apports estimés.</p>}
      {est && (
        <div>
          <h4 className="mb-1.5 text-sm font-semibold">Apports estimés <span className="font-normal text-ink/60">· visibles des admins seulement</span></h4>
          <dl className="grid grid-cols-4 gap-2">
            <Tile label="Énergie" value={<span className="text-xl">{est.kcal}</span>} sub="kcal" />
            <Tile label="Protéines" value={<span className="text-xl">{est.protein}</span>} sub="g" />
            <Tile label="Glucides" value={<span className="text-xl">{est.carbs}</span>} sub="g" />
            <Tile label="Lipides" value={<span className="text-xl">{est.fat}</span>} sub="g" />
          </dl>
          {est.missing > 0 && <p className="mt-1 text-xs text-ink/60">{est.missing} aliment{est.missing > 1 ? 's' : ''} sans valeur connue, non compté{est.missing > 1 ? 's' : ''}.</p>}
        </div>
      )}

      {!staff && (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-sm font-semibold">J'ai bu</h4>
          <div className="grid grid-cols-3 gap-1.5">
            {WATER.map(([v, label]) => (
              <Button key={v} type="button" variant="ghost" size="sm" disabled={addWater.isPending} onClick={() => addWater.mutate({ day, ml: v })}>
                <span className="block">{label}</span><span className="mt-1 block text-xs font-normal text-ink/60">+ {v} mL</span></Button>
            ))}
          </div>
          {addWater.isError && <p role="alert" className="text-sm text-rnr">Enregistrement impossible, réessaie.</p>}
          {drunk.length > 0 && <Button type="button" variant="quiet" className="self-start" disabled={delWater.isPending}
            onClick={() => delWater.mutate(drunk[drunk.length - 1].id)}>Annuler le dernier ({drunk[drunk.length - 1].ml} mL)</Button>}
        </div>
      )}

      <div className="flex flex-col">
        {MEALS.map(([meal, label]) => {
          const mine = dayItems.filter(i => i.meal === meal)
          return (
            <section key={meal} className="flex flex-col gap-1 border-t border-line/60 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h4 className="text-sm font-semibold">{label}</h4>
                {hasCourses(meal) && mine.length > 0 && !mine.some(i => i.food?.category === 'plat') && (
                  <ul className="flex gap-2.5 text-xs" aria-label="Repas complet">
                    {mealParts(mine.map(i => i.food?.category ?? 'autre')).map(([p, ok]) => (
                      <li key={p} className={`flex items-center gap-1 ${ok ? '' : 'text-ink/60'}`}>
                        <span aria-hidden="true" className={`size-2 rounded-full ${ok ? 'bg-ok' : 'ring-1 ring-inset ring-ink/40'}`} />{PART_LABEL[p]}<span className="sr-only">{ok ? ' : oui' : ' : manque'}</span></li>
                    ))}
                  </ul>
                )}
              </div>
              {mine.length > 0 && <ul className="flex flex-col">{mine.map(i => <ItemRow key={i.id} item={i} onDelete={staff ? undefined : () => delItem.mutate(i.id)} busy={delItem.isPending} />)}</ul>}
              {staff ? mine.length === 0 && <p className="text-sm text-ink/60">Rien de saisi.</p>
                : adding === meal ? <AddFood playerId={playerId} day={day} meal={meal} recents={recents} onClose={() => setAdding(null)} />
                  : <button type="button" onClick={() => setAdding(meal)} aria-label={`Ajouter un aliment : ${label}`} className="flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-gold"><Plus size={18} aria-hidden="true" />Ajouter un aliment</button>}
            </section>
          )
        })}
      </div>
      {delItem.isError && <p role="alert" className="text-sm text-rnr">Suppression impossible, réessaie.</p>}
    </div>
  )
}

function ItemRow({ item, onDelete, busy }: { item: MealItem; onDelete?: () => void; busy: boolean }) {
  const course = COURSES.find(c => c[0] === item.course)?.[1]
  return (
    <li className="flex min-h-11 items-center justify-between gap-2">
      <div className="min-w-0 py-1">
        <p className="text-sm [overflow-wrap:anywhere]">{item.food?.name ?? 'Aliment supprimé'}</p>
        <p className="text-xs text-ink/60">{course ? `${course} · ` : ''}{qty(item)}</p>
      </div>
      {onDelete && <button type="button" onClick={onDelete} disabled={busy} aria-label={`Retirer ${item.food?.name ?? 'cet aliment'}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-ink/60 hover:text-ink disabled:opacity-40"><X size={18} aria-hidden="true" /></button>}
    </li>
  )
}

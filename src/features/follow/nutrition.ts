// Suivi nutrition (étape 14) : repas, portions et indicateurs. Côté joueur, jamais de calories ni de macros.

export const MEALS = [
  ['petit_dejeuner', 'Petit-déjeuner'], ['collation_matin', 'Collation du matin'], ['dejeuner', 'Déjeuner'],
  ['gouter', 'Goûter'], ['diner', 'Dîner'], ['collation_soir', 'Collation du soir'],
] as const
export type Meal = typeof MEALS[number][0]
export const MAIN_MEALS: readonly Meal[] = ['petit_dejeuner', 'dejeuner', 'diner']
export const COURSES = [['entree', 'Entrée'], ['plat', 'Plat'], ['dessert', 'Dessert']] as const
export const hasCourses = (meal: Meal) => meal === 'dejeuner' || meal === 'diner'

export const CATEGORIES = [
  ['proteine', 'Protéine'], ['feculent', 'Féculent'], ['legume', 'Légume'], ['fruit', 'Fruit'], ['laitier', 'Laitier'],
  ['plat', 'Plat composé'], ['boisson', 'Boisson'], ['sucre', 'Sucré'], ['gras', 'Matière grasse'], ['autre', 'Autre'],
] as const

// Quantités : unités exactes puis portions simples, chacune avec son équivalent en grammes.
// shortcut: équivalents moyens, identiques pour tous les aliments (une « unité » = 100 g, œuf comme pomme) ; passer à des
// portions par aliment (table food_portions) quand le staff voudra des apports estimés plus fins.
export const PORTIONS: readonly (readonly [string, number])[] = [
  ['g', 1], ['kg', 1000], ['mL', 1], ['L', 1000],
  ['petite portion', 100], ['portion moyenne', 200], ['grande portion', 300],
  ['assiette', 300], ['bol', 250], ['verre', 200], ['tranche', 30], ['unité', 100],
  ['c. à soupe', 15], ['c. à café', 5], ['poignée', 30], ['paume', 100], ['poing', 150], ['pouce', 10],
]
// « 1,5 » ou « 1.5 » ; tout le reste (vide, lettres, « 1 000 ») = pas de quantité
export const parseQuantity = (text: string) => (/^\d+([.,]\d{1,2})?$/.test(text.trim()) ? parseFloat(text.trim().replace(',', '.')) : NaN)
export const gramsOf = (quantity: number, unit: string) => Math.round(quantity * (PORTIONS.find(p => p[0] === unit)?.[1] ?? 0) * 10) / 10
export const defaultUnit = (category: string) => (category === 'boisson' ? 'verre' : 'portion moyenne')

export const WATER_TARGET_ML = 2000 // shortcut: même repère pour tous, à régler par joueur avec les réglages du suivi
export const litres = (ml: number) => `${(ml / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}\u00a0L`

// Repas complet : une protéine, un féculent et un légume (d'après la catégorie de l'aliment, pas ses valeurs).
// Un plat composé ne compte pour aucune des trois : on ne sait pas ce qu'il contient.
const PARTS = ['proteine', 'feculent', 'legume'] as const
export const mealParts = (categories: string[]) => PARTS.map(p => [p, categories.includes(p)] as const)
export const isComplete = (categories: string[]) => PARTS.every(p => categories.includes(p))

type Item = { day: string; meal: string; food: { category: string } | null }
// Le bilan d'une journée : repas principaux saisis, déjeuner et dîner complets
export function dayStats(items: Item[], day: string) {
  const of = (meal: string) => items.filter(i => i.day === day && i.meal === meal).map(i => i.food?.category ?? 'autre')
  return {
    mainMeals: MAIN_MEALS.filter(m => of(m).length > 0).length,
    complete: (['dejeuner', 'diner'] as const).filter(m => isComplete(of(m))).length,
  }
}

type Nutrients = { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }
// Apports estimés (staff) : valeurs pour 100 g × grammes saisis. missing = aliments sans valeur (aliment personnel).
export function intake(items: { grams: number; nutrients: Nutrients | null }[]) {
  const sum = (k: keyof Nutrients) => Math.round(items.reduce((s, i) => s + (i.nutrients?.[k] ?? 0) * i.grams / 100, 0))
  return { kcal: sum('kcal'), protein: sum('protein_g'), carbs: sum('carbs_g'), fat: sum('fat_g'), missing: items.filter(i => i.nutrients?.kcal == null).length }
}

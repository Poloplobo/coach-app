// Charge la table Ciqual (ANSES, Licence Ouverte 2.0) dans foods + food_nutrients. Jamais par migration.
// Source : « Table Ciqual 2025_FR » (.xlsx) sur https://entrepot.recherche.data.gouv.fr (doi:10.57745/RDMHWY).
// Usage : node --env-file=.env.local scripts/load-ciqual.mjs <fichier.xlsx>                    (simulation)
//         node --env-file=.env.local scripts/load-ciqual.mjs <fichier.xlsx> --confirm=<ref projet>
// Relançable : un aliment déjà chargé (même code Ciqual) est mis à jour, jamais doublé.
import pg from 'pg'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

// Catégorie du « repas complet », d'après le sous-groupe Ciqual (2 premiers chiffres = groupe)
const BY_SUBGROUP = { '0201': 'legume', '0202': 'feculent', '0203': 'feculent', '0204': 'fruit', '0303': 'autre', '0305': 'autre', '0504': 'gras', '0707': 'feculent' }
const BY_GROUP = { '01': 'plat', '02': 'autre', '03': 'feculent', '04': 'proteine', '05': 'laitier', '06': 'boisson', '07': 'sucre', '08': 'sucre', '09': 'gras' }
// Écartés : aliments infantiles (groupe 11) et boissons alcoolisées (0603), sans objet pour des joueurs mineurs
const skipped = sub => sub.startsWith('11') || sub === '0603'
export const categoryOf = sub => BY_SUBGROUP[sub] ?? BY_GROUP[sub.slice(0, 2)] ?? 'autre'
// « 12,5 », « < 0,5 », « traces », « - » : nombre, ou rien
export const num = v => { const n = parseFloat(String(v ?? '').replace('<', '').replace(',', '.')); return Number.isFinite(n) ? n : null }

if (process.argv[1]?.endsWith('load-ciqual.mjs')) {
  const file = process.argv[2]
  if (!file) throw new Error('Usage : load-ciqual.mjs <fichier.xlsx> [--confirm=<ref projet>]')
  const rows = XLSX.utils.sheet_to_json(XLSX.read(readFileSync(file)).Sheets['composition nutritionnelle'], { header: 1, raw: true })
  const head = rows[0].map(h => String(h).replace(/\s+/g, ' '))
  const col = start => { const i = head.findIndex(h => h.startsWith(start)); if (i < 0) throw new Error(`colonne absente : ${start}`); return i }
  const C = { sub: col('alim_ssgrp_code'), code: col('alim_code'), name: col('alim_nom_fr'), kcal: col('Energie, Règlement UE N° 1169 2011 (kcal'),
    protein: col('Protéines, N x facteur de Jones'), carbs: col('Glucides'), fat: col('Lipides') }
  // sous-groupe remis sur 4 chiffres : lu comme un nombre, « 0603 » deviendrait 603 et plus rien ne serait classé
  const sub = r => String(r[C.sub]).padStart(4, '0')
  const foods = rows.slice(1).filter(r => Number.isInteger(Number(r[C.code])) && r[C.name] && !skipped(sub(r))).map(r => ({
    ciqual_code: Number(r[C.code]), name: String(r[C.name]).replace(/\s+/g, ' ').trim().slice(0, 120), category: categoryOf(sub(r)),
    kcal: num(r[C.kcal]), protein_g: num(r[C.protein]), carbs_g: num(r[C.carbs]), fat_g: num(r[C.fat]) }))
  const ref = new URL(process.env.SUPABASE_DB_URL).username.split('.')[1] ?? ''
  const confirm = process.argv.find(a => a.startsWith('--confirm='))?.split('=')[1]
  console.log(`${foods.length} aliments lus, projet ${ref}`)
  console.table(Object.entries(Object.groupBy(foods, f => f.category)).map(([category, l]) => ({ category, aliments: l.length })))
  if (!confirm) { console.log('Simulation : rien n\'est écrit. Ajoute --confirm=<ref projet> pour charger.'); process.exit(0) }
  if (confirm !== ref) throw new Error(`ARRÊT : --confirm=${confirm} ne correspond pas au projet ${ref}`)
  const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
  await db.connect()
  // Une seule requête, donc une seule transaction : tout est chargé, ou rien
  const res = await db.query(`
    with src as (select * from jsonb_to_recordset($1::jsonb)
                 as x(ciqual_code int, name text, category text, kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric)),
    up as (insert into public.foods (ciqual_code, name, category) select ciqual_code, name, category from src
           on conflict (ciqual_code) do update set name = excluded.name   -- la catégorie, corrigeable par l'admin, n'est pas écrasée
           returning id, ciqual_code)
    insert into public.food_nutrients (food_id, kcal, protein_g, carbs_g, fat_g)
    select up.id, src.kcal, src.protein_g, src.carbs_g, src.fat_g from up join src using (ciqual_code)
    on conflict (food_id) do update set kcal = excluded.kcal, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, fat_g = excluded.fat_g`,
    [JSON.stringify(foods)])
  await db.end()
  console.log(`${res.rowCount} aliments chargés`)
}

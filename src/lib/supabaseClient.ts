import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Clé publique uniquement : la sécurité repose sur la RLS. Jamais de clé secrète ici.
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

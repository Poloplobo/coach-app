import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

// Photos détourées des joueurs (stockage privé « player-photos », « <id>.png ») : liens signés d'une heure, chargés une
// fois pour toute l'app. RLS : le staff reçoit toutes les photos, un joueur seulement la sienne (0045).
export function usePhotoUrls() {
  return useQuery({
    queryKey: ['photos'],
    staleTime: 50 * 60 * 1000, // avant l'expiration des liens
    queryFn: async () => {
      const bucket = supabase.storage.from('player-photos')
      const { data: files, error } = await bucket.list('', { limit: 1000 })
      if (error) throw error
      const paths = files.map(f => f.name).filter(n => n.endsWith('.png'))
      if (!paths.length) return new Map<string, string>()
      const { data, error: e } = await bucket.createSignedUrls(paths, 3600)
      if (e) throw e
      return new Map(data.flatMap(d => (d.signedUrl && d.path ? [[d.path.replace(/\.png$/, ''), d.signedUrl] as const] : [])))
    },
  })
}

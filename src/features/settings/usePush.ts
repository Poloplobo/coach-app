import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

// Rappel du matin (0026) : abonnement de CE téléphone aux notifications, enregistré pour le joueur connecté (RLS)
export type PushState = 'unavailable' | 'install' | 'denied' | 'off' | 'on'

const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
// iPhone : les notifications n'existent que dans l'app installée sur l'écran d'accueil
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const toKey = (base64: string) => {
  const raw = atob((base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

async function save(sub: PushSubscription) {
  const { endpoint, keys } = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions')
    .upsert({ endpoint: endpoint!, p256dh: keys!.p256dh, auth: keys!.auth }, { onConflict: 'endpoint' })
  if (error) throw error
}

export function usePushState() {
  return useQuery({
    queryKey: ['push'],
    queryFn: async (): Promise<PushState> => {
      if (!KEY) return 'unavailable'
      if (!supported()) return isIos() ? 'install' : 'unavailable'
      if (Notification.permission === 'denied') return 'denied'
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
      if (!sub) return 'off'
      await save(sub) // réenregistré à chaque ouverture : la base l'avait peut-être retiré (abonnement renouvelé)
      return 'on'
    },
    staleTime: Infinity,
  })
}

// Déconnexion : ce téléphone ne reçoit plus les rappels de ce joueur (un autre peut s'y connecter) ; au mieux, sans bloquer
export async function unsubscribeThisDevice() {
  try {
    if (!supported()) return
    // sans service worker actif (dev, navigateur qui l'a coupé), ready n'aboutit jamais : on n'attend pas plus de 2 s
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<null>(r => setTimeout(() => r(null), 2000))])
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  } catch { /* hors ligne : l'abonnement sera refusé puis retiré plus tard */ }
}

export function useTogglePush() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (on: boolean): Promise<PushState> => {
      // iPhone : la demande d'autorisation doit partir directement du toucher, avant toute attente
      const permission = on ? Notification.requestPermission() : null
      const reg = await navigator.serviceWorker.ready
      if (!on) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          if (error) throw error
          await sub.unsubscribe()
        }
        return 'off'
      }
      if (await permission !== 'granted') return Notification.permission === 'denied' ? 'denied' : 'off' // fermé sans répondre : réessayable
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(KEY!) })
      await save(sub)
      return 'on'
    },
    onSuccess: state => qc.setQueryData(['push'], state),
  })
}

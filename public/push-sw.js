// Rappel du matin : notification envoyée par /api/wellness-reminder ; un toucher ouvre l'onglet Forme
self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { /* message illisible : texte par défaut */ }
  event.waitUntil(self.registration.showNotification(data.title || 'Pôle Espoir', {
    body: data.body || 'Pense à remplir ton état de forme du jour.',
    icon: '/pwa-192x192.png', badge: '/pwa-64x64.png', tag: 'wellness', data: { url: data.url || '/joueur/forme' },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/joueur/forme'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => 'focus' in c)
    if (open) return open.navigate(url).then(c => (c || open).focus())
    return self.clients.openWindow(url)
  }))
})

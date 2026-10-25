import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // xlsx et pptxgenjs (imports / exports staff) se chargent à la demande : pas de préchargement sur les téléphones des joueurs
      workbox: { globIgnores: ['**/xlsx-*.js', '**/pptxgen*.js', '**/exportPptx-*.js'] },
      manifest: {
        name: 'Rugby Tracker — Rouen Normandie Rugby',
        short_name: 'Rugby Tracker',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#1A1A1A',
        theme_color: '#1A1A1A',
        // PNG générés depuis public/logo-rnr.svg par npx pwa-assets-generator (pwa-assets.config.ts)
        icons: [
          { src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Rugby Tracker — Rouen Normandie Rugby',
        short_name: 'Rugby Tracker',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#1A1A1A',
        theme_color: '#1A1A1A',
        icons: [{ src: '/logo-rnr.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
})

import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Icônes PNG d'installation (l'iPhone ignore les SVG du manifeste) : npx pwa-assets-generator
const background = '#1A1A1A'
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background, fit: 'contain' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background, fit: 'contain' } },
  },
  images: ['public/logo-rnr.svg'],
})

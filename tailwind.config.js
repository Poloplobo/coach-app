import { BRAND } from './src/lib/brand.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Charte RNR (CLAUDE.md) : utiliser ces noms, jamais de couleur en dur dans le JSX.
      // app / surface / line / ink / gold suivent le thème (variables de src/index.css) ; rnr / ok sont fixes.
      colors: {
        app: 'rgb(var(--app) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        ...BRAND,
        gold: 'rgb(var(--gold) / <alpha-value>)', // or plus foncé en thème clair (lisibilité du texte)
        // fond des champs et boutons d'échelle : translucide, lisible sur la page comme dans un bloc
        field: 'rgb(var(--ink) / 0.06)',
      },
      fontFamily: {
        // Barlow : texte courant ; Barlow Condensed : chiffres, titres, navigation (esprit tableau d'affichage)
        sans: ['Barlow', 'system-ui', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Barlow', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

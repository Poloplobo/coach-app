/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Charte RNR (CLAUDE.md) : utiliser ces noms, jamais de couleur en dur dans le JSX.
      // app / surface / line / ink suivent le thème (variables de src/index.css) ; rnr / gold / ok sont fixes.
      colors: {
        app: 'rgb(var(--app) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        rnr: '#C8102E',
        gold: '#FFD700',
        ok: '#10b981',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

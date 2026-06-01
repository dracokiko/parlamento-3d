/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cores institucionais
        'ar-bg': '#1a1a2e',
        'ar-panel': '#f5f5f5',
        'ar-accent': '#0066cc',
        // Cores dos partidos políticos portugueses (XVII Legislatura)
        partido: {
          psd: '#FF6600',
          ps: '#FF66B2',
          chega: '#1C3F7A',
          il: '#00A0E3',
          be: '#E3000F',
          pcp: '#D42D20',
          livre: '#00C261',
          pan: '#00A03E'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      },
      borderRadius: {
        'card': '8px'
      },
      transitionDuration: {
        '250': '250ms'
      }
    },
  },
  plugins: [],
}

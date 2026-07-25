/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        live: {
          ink: '#120C08',
          bark: '#24170F',
          card: '#352216',
          cream: '#EADAB5',
          green: '#304C2D',
          gold: '#D7A663',
          text: '#F8F1E7',
          muted: '#BFAF9D'
        }
      },
      boxShadow: {
        glow: '0 0 35px rgba(215,166,99,.22)'
      }
    }
  },
  plugins: []
}

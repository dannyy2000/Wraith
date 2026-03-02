import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './providers/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        wraith: {
          purple: '#8B5CF6',
          'purple-dim': '#6D28D9',
          'purple-glow': '#A78BFA',
          bg: '#080810',
          surface: '#0f0f1a',
          'surface-2': '#161625',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-purple': '0 0 20px rgba(139,92,246,0.25)',
        'glow-purple-lg': '0 0 40px rgba(139,92,246,0.2)',
        card: '0 1px 3px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
        'card-hover': '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.4)',
      },
      backgroundImage: {
        'purple-glow': 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(139,92,246,0.12) 0%, transparent 70%)',
        'card-gradient': 'linear-gradient(145deg, #0f0f1a 0%, #111120 100%)',
      },
    },
  },
  plugins: [],
}

export default config

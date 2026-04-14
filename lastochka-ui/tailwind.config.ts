import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ─── Бренд-цвета Ласточки ───────────────────────────
        brand: {
          DEFAULT: '#2AABEE',   // Telegram-like blue
          dark:    '#1e96d4',
          light:   '#d6eef8',
        },
        // ─── Пузыри сообщений ────────────────────────────────
        bubble: {
          own:       '#EFFDDE',   // своё сообщение (светло-зелёный)
          peer:      '#FFFFFF',   // чужое сообщение
          'own-dark':  '#2b5278',
          'peer-dark': '#182533',
        },
        // ─── Фоны ────────────────────────────────────────────
        sidebar:   { DEFAULT: '#FFFFFF', dark: '#17212b' },
        chat:      { DEFAULT: '#EFEFF3', dark: '#0e1621' },
        header:    { DEFAULT: '#FFFFFF', dark: '#17212b' },
        input:     { DEFAULT: '#FFFFFF', dark: '#17212b' },
        'input-field': { DEFAULT: '#f0f0f0', dark: '#242f3d' },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto',
               '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        bubble: '18px',
        'bubble-sm': '4px',
      },
      boxShadow: {
        bubble:    '0 1px 2px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.04)',
        panel:     '0 1px 3px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.04)',
        glass:     '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
        'glass-lg':'0 16px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
        fab:       '0 4px 16px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)',
      },
      animation: {
        'slide-up':   'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in':    'fadeIn 0.2s ease-out',
        'scale-in':   'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce-in':  'bounceIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float':      'float 6s ease-in-out infinite',
        'shimmer':    'shimmer 2s linear infinite',
      },
      keyframes: {
        slideUp: {
          '0%':   { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%':   { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%':   { transform: 'scale(0.92)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.3)', opacity: '0' },
          '50%':  { transform: 'scale(1.06)' },
          '70%':  { transform: 'scale(0.96)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config

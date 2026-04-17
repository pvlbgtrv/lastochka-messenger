/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#5B5EF4',
          dark: '#4338CA',
          light: '#7B8AFF',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          variant: '#F5F5F7',
          dark: '#17212B',
          'variant-dark': '#1E2C3A',
        },
        background: {
          DEFAULT: '#EFEFF3',
          dark: '#0E1621',
        },
        bubble: {
          own: '#EEF2FF',
          'own-dark': '#2B5278',
          peer: '#FFFFFF',
          'peer-dark': '#182533',
        },
        online: '#40C040',
        muted: '#9E9E9E',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        bubble: '16px',
        'bubble-sm': '12px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.08)',
        'glass-lg': '0 12px 40px rgba(0, 0, 0, 0.12)',
        bubble: '0 1px 2px rgba(0, 0, 0, 0.06)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-out-left': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'bounce-in': {
          '0%': { transform: 'scale(0)' },
          '60%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'online-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(64, 192, 64, 0.4)' },
          '50%': { boxShadow: '0 0 0 6px rgba(64, 192, 64, 0)' },
        },
        'reaction-pop': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-out-left': 'slide-out-left 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 0.2s ease-out',
        'bounce-in': 'bounce-in 0.3s ease-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'online-pulse': 'online-pulse 2s infinite',
        'reaction-pop': 'reaction-pop 0.25s ease-out',
      },
    },
  },
  plugins: [],
}

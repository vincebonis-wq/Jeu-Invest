/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette de jeu colorée
        brand: {
          50: '#eef9ff',
          100: '#d9f1ff',
          200: '#bce7ff',
          300: '#8ed8ff',
          400: '#59c0ff',
          500: '#33a3ff',
          600: '#1c84f5',
          700: '#156be1',
          800: '#1857b6',
          900: '#1a4b8f',
        },
        gold: {
          400: '#ffd34d',
          500: '#fbbf24',
          600: '#f59e0b',
          700: '#d97706',
        },
        money: {
          up: '#16a34a',
          down: '#dc2626',
        },
      },
      fontFamily: {
        display: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 20px -4px rgba(0,0,0,0.12)',
        'card-hover': '0 12px 32px -8px rgba(0,0,0,0.20)',
        glow: '0 0 24px -2px rgba(51,163,255,0.5)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '60%': { transform: 'scale(1.03)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(40px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'pop-in': 'pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        'slide-in-right': 'slide-in-right 0.4s ease-out',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.22,1,0.36,1)',
        float: 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

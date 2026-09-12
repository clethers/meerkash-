import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefbf4', 100: '#d6f5e3', 200: '#b0e9cb', 300: '#7dd7ad',
          400: '#47bd8b', 500: '#22a170', 600: '#15825a', 700: '#12684a',
          800: '#12523c', 900: '#104433', 950: '#06261d',
        },
        paper: '#eef2ee',
        receipt: '#fbfbf8',
        ink: '#10241c',
        night: '#07130e',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;

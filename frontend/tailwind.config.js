/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#090D16',
          card: '#111827',
          tertiary: '#1F2937',
          blue: '#3B82F6',
          cyan: '#06B6D4',
          green: '#10B981',
          amber: '#F59E0B',
          red: '#EF4444',
          purple: '#8B5CF6'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}

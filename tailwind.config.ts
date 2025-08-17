import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./styles/**/*.css"
  ],
  theme: {
    extend: {
      boxShadow: { 'soft': '0 10px 30px rgba(0,0,0,0.08)' },
    },
  },
  plugins: [],
}
export default config

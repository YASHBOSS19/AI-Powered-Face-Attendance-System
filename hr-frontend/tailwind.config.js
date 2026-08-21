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
          navy: '#2c3e50',
          dark: '#1a2530',
          teal: '#1abc9c',
          blue: '#3498db'
        }
      }
    },
  },
  plugins: [],
}

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
          navy: '#1a4751',
          dark: '#113038',
          teal: '#21c4c9',
          blue: '#358c97'
        }
      },
      animation: {
        'marquee': 'marquee 15s linear infinite',
        'float': 'float 10s ease-in-out infinite',
        'float-delayed': 'float 12s ease-in-out 2s infinite',
        'pulse-glow': 'pulse-glow 6s ease-in-out infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(10%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-20px) scale(1.05)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: 0.4, transform: 'scale(1)' },
          '50%': { opacity: 0.8, transform: 'scale(1.1)' },
        }
      }
    },
  },
  plugins: [],
}

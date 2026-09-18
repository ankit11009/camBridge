/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Arial', 'Helvetica', 'sans-serif'] },
      colors: { indigo: { 100: '#CFFFDC', 200: '#B9E7C7', 300: '#2E6F40', 400: '#2E6F40', 500: '#3F8453', 600: '#2E6F40', 700: '#253D2C', 900: '#253D2C' } },
    },
  },
  plugins: [],
}

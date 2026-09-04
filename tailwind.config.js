/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1F4E78',
          light: '#3E7CB1',
          dark: '#153552'
        }
      }
    },
  },
  plugins: [],
}

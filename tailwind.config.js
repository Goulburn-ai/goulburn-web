/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.html',
    './public/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors — re-tinted for dark mode so gradients
        // (from-brand-50, from-brand-100) render as dark gold tints on black.
        // 200+ unchanged so CTA buttons keep their iconic gold.
        brand: {
          50: '#1C1409',
          100: '#3D2810',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F'
        },
        // Dark scale — inverted from Tailwind's stock grays.
        // dark-50 (near-black) used for page wash, dark-900 (near-white) for headings.
        dark: {
          50:  '#0A0A0A',   // was near-white — now near-black (page wash)
          100: '#16181C',   // X card colour
          200: '#2F3336',   // X hairline border
          300: '#3E4144',
          400: '#71767B',   // X secondary text
          500: '#8B98A5',   // readable muted
          600: '#B1B7BD',
          700: '#D1D5DB',
          800: '#E5E7EB',
          900: '#F7F9F9'    // near-white — used for headings
        }
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif']
      }
    }
  }
}

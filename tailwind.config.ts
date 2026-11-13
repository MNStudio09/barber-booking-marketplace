import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Premium clean palette: charcoal black, white, warm beige.
        charcoal: {
          950: '#171412',
          900: '#211d1a',
          800: '#2d2824',
          700: '#3d3630',
          600: '#57504a',
          500: '#6f675f',
        },
        beige: {
          50: '#faf7f1',
          100: '#f3ede1',
          200: '#e7dcc6',
          300: '#d9c8a6',
          400: '#c8b18a',
        },
        sand: '#f3ede1',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;

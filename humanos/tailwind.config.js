/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'human-os-bg': '#0a0e27',
        'human-os-cyan': '#2dd4bf',
        'human-os-amber': '#fbbf24',
      },
    },
  },
  plugins: [],
};

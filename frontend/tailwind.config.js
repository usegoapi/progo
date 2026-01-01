/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: '#eaa800',
        'primary-hover': '#dba000',
        'background-dark': '#0d0d0d',
        'surface-dark': '#161616',
        'surface-light': '#1f1f1f',
        'border-dark': '#2a2a2a',
        success: '#4CAF50',
        danger: '#F44336',
        warning: '#ffc107',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(234, 168, 0, 0.15)',
        card: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
};

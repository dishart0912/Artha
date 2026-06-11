/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ocean:     '#0f2d4a',
        blueberry: '#1a4a8a',
        bluebird:  '#2d6cc0',
        skylight:  '#90b8e0',
        clouds:    '#f0f6ff',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        fadeIn:  'fadeIn 0.4s ease forwards',
        scaleIn: 'scaleIn 0.3s ease forwards',
      },
      keyframes: {
  fadeIn: {
    '0%':   { opacity: '0', transform: 'translateY(10px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
  scaleIn: {
    '0%':   { opacity: '0', transform: 'scale(0.95)' },
    '100%': { opacity: '1', transform: 'scale(1)' },
  },
  float1: {
    '0%, 100%': { transform: 'translateY(0px)' },
    '50%':      { transform: 'translateY(-20px)' },
  },
  float2: {
    '0%, 100%': { transform: 'translateY(0px)' },
    '50%':      { transform: 'translateY(-14px)' },
  },
  float3: {
    '0%, 100%': { transform: 'translateY(0px)' },
    '50%':      { transform: 'translateY(-8px)' },
  },
},
animation: {
  fadeIn:  'fadeIn 0.4s ease forwards',
  scaleIn: 'scaleIn 0.3s ease forwards',
  float1:  'float1 6s ease-in-out infinite',
  float2:  'float2 4s ease-in-out infinite',
  float3:  'float3 5s ease-in-out infinite',
},
    },
  },
  plugins: [],
}
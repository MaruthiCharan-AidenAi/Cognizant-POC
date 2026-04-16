/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        gcp: {
          blue: '#4285F4',
          'blue-dark': '#1A73E8',
          'blue-light': '#E8F0FE',
          green: '#34A853',
          'green-light': '#E6F4EA',
          yellow: '#FBBC04',
          'yellow-light': '#FEF7E0',
          red: '#EA4335',
          'red-light': '#FCE8E6',
          gray: {
            50: '#F8F9FA',
            100: '#F1F3F4',
            200: '#E8EAED',
            300: '#DADCE0',
            400: '#BDC1C6',
            500: '#9AA0A6',
            600: '#80868B',
            700: '#5F6368',
            800: '#3C4043',
            900: '#202124',
          },
        },
        confidence: {
          high: '#34A853',
          'high-bg': '#E6F4EA',
          medium: '#F9AB00',
          'medium-bg': '#FEF7E0',
          low: '#EA4335',
          'low-bg': '#FCE8E6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Google Sans', 'Roboto', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-dot': 'pulseDot 1.4s infinite ease-in-out both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 80%, 100%': { transform: 'scale(0)' },
          '40%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}

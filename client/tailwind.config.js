/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cosmos: {
          900: '#050817',
          800: '#080d24',
          700: '#0c1330',
          600: '#10183c',
        },
        neon: {
          cyan: '#22d3ee',
          violet: '#a78bfa',
          magenta: '#e879f9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'grid-glow':
          'radial-gradient(circle at center, rgba(34,211,238,0.15) 0%, transparent 70%)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        twinkle: 'twinkle 4s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 1, filter: 'brightness(1)' },
          '50%': { opacity: 0.7, filter: 'brightness(1.4)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        twinkle: {
          '0%, 100%': { opacity: 0.2 },
          '50%': { opacity: 1 },
        },
      },
      boxShadow: {
        glow: '0 0 40px rgba(34,211,238,0.4)',
        'glow-violet': '0 0 40px rgba(167,139,250,0.4)',
        'glow-magenta': '0 0 40px rgba(232,121,249,0.4)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

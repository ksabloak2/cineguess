/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Tile colors — vivid for readability
        tile: {
          green:          '#22c55e',
          'orange-yellow': '#f59e0b',
          'light-yellow': '#eab308',
          red:            '#ef4444',
          empty:          '#1e1e2e',
          border:         '#2a2a3a',
        },
        // App surfaces — deep cinematic tones
        surface: {
          bg:     '#0a0a0f',
          card:   '#12121c',
          nav:    '#0e0e16',
          input:  '#1a1a2a',
          border: '#252538',
        },
        accent: {
          DEFAULT: '#f59e0b',
          hover:   '#fbbf24',
          dim:     '#78350f',
        },
        cinema: {
          gold:    '#f59e0b',
          amber:   '#fbbf24',
          purple:  '#a855f7',
          blue:    '#3b82f6',
          pink:    '#ec4899',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'flip-in':    'flipIn 0.5s ease forwards',
        'bounce-in':  'bounceIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'fade-in':    'fadeIn 0.4s ease',
        'slide-up':   'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-r': 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'glow-pulse':    'glowPulse 2s ease-in-out infinite',
        'float':         'float 6s ease-in-out infinite',
        'shimmer':       'shimmer 2s linear infinite',
        'curtain-rise':  'curtainRise 0.55s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        flipIn: {
          '0%':   { transform: 'rotateX(0deg)' },
          '50%':  { transform: 'rotateX(-90deg)' },
          '100%': { transform: 'rotateX(0deg)' },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.8)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
        slideUp: {
          from: { transform: 'translateY(30px)', opacity: 0 },
          to:   { transform: 'translateY(0)', opacity: 1 },
        },
        slideInRight: {
          from: { transform: 'translateX(-24px)', opacity: 0.5 },
          to:   { transform: 'translateX(0)', opacity: 1 },
        },
        glowPulse: {
          '0%, 100%': { opacity: 0.4 },
          '50%':      { opacity: 0.8 },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        curtainRise: {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};

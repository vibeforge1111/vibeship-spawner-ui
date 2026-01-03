/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Vibeship exact color palette
      colors: {
        // Background colors - Vibeship dark theme
        bg: {
          primary: '#0e1016',
          secondary: '#151820',
          tertiary: '#1c202a',
          elevated: '#242936',
          inverse: '#ffffff',
          overlay: 'rgba(0, 0, 0, 0.8)'
        },
        // Surface colors
        surface: {
          DEFAULT: '#151820',
          hover: '#1c202a',
          active: '#242936',
          border: '#2a3042',
          'border-strong': '#3d4558'
        },
        // Text colors - Vibeship
        text: {
          primary: '#e2e4e9',
          secondary: '#9aa3b5',
          tertiary: '#6b7489',
          inverse: '#0e1016'
        },
        // Accent colors - Vibeship teal
        accent: {
          primary: '#00C49A', // Vibeship teal
          'primary-hover': '#00e6b5',
          'primary-dim': '#00a882',
          secondary: '#9D8CFF', // Violet
          'secondary-hover': '#b3a5ff'
        },
        // Vibeship brand colors
        vibe: {
          teal: '#00C49A',
          'teal-glow': 'rgba(0, 196, 154, 0.15)',
          'teal-border': 'rgba(0, 196, 154, 0.3)',
          green: '#2ECC71',
          'green-glow': 'rgba(46, 204, 113, 0.15)',
          violet: '#9D8CFF',
          'violet-glow': 'rgba(157, 140, 255, 0.15)',
          orange: '#FFB020',
          pink: '#FF66C4',
          blue: '#3399FF'
        },
        // Category colors (for skill nodes) - Vibeship palette
        category: {
          development: '#2ECC71', // Green
          integration: '#00C49A', // Teal
          ai: '#FFB020', // Orange
          data: '#3399FF', // Blue
          marketing: '#FF66C4', // Pink
          strategy: '#00C49A', // Teal
          agents: '#FFB020', // Orange
          mind: '#9D8CFF' // Violet
        },
        // Status colors - Vibeship
        status: {
          success: '#2ECC71',
          'success-bg': 'rgba(46, 204, 113, 0.1)',
          warning: '#FFB020',
          'warning-bg': 'rgba(255, 176, 32, 0.1)',
          error: '#FF4D4D',
          'error-bg': 'rgba(255, 77, 77, 0.1)',
          info: '#00C49A',
          'info-bg': 'rgba(0, 196, 154, 0.1)'
        },
        // Port type colors - Vibeship
        port: {
          text: '#2ECC71',
          number: '#3399FF',
          boolean: '#FFB020',
          object: '#9D8CFF',
          array: '#FF66C4',
          any: '#6b7489',
          skill: '#00C49A'
        },
        // Ghost state - Vibeship teal
        ghost: {
          bg: 'rgba(0, 196, 154, 0.08)',
          border: 'rgba(0, 196, 154, 0.25)'
        }
      },
      // Typography
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif']
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display': ['3.5rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
        'stat': ['4rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '700' }]
      },
      // Spacing (using 4px base)
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '2.5': '10px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
        '24': '96px'
      },
      // Border radius - Sharp Vibeship style
      borderRadius: {
        'none': '0',
        'sm': '2px',
        'DEFAULT': '4px',
        'md': '6px',
        'lg': '8px',
        'xl': '8px',
        'full': '9999px'
      },
      // Shadows with Vibeship teal glow
      boxShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.4)',
        'DEFAULT': '0 4px 12px rgba(0, 0, 0, 0.5)',
        'lg': '0 8px 24px rgba(0, 0, 0, 0.6)',
        'xl': '0 12px 48px rgba(0, 0, 0, 0.7)',
        // Vibeship glow effects - teal
        'glow-teal': '0 0 20px rgba(0, 196, 154, 0.4)',
        'glow-teal-lg': '0 0 40px rgba(0, 196, 154, 0.3)',
        'glow-teal-intense': '0 0 30px rgba(0, 196, 154, 0.6), 0 0 60px rgba(0, 196, 154, 0.3)',
        'glow-green': '0 0 20px rgba(0, 196, 154, 0.3)',
        'glow-violet': '0 0 20px rgba(157, 140, 255, 0.4)',
        'glow-error': '0 0 20px rgba(255, 77, 77, 0.4)',
        // Card glow on hover - Vibeship teal
        'card-glow': '0 0 0 1px rgba(0, 196, 154, 0.2), 0 0 20px rgba(0, 196, 154, 0.1)'
      },
      // Animation
      animation: {
        'fade-in': 'fadeIn 300ms ease-out',
        'slide-up': 'slideUp 300ms ease-out',
        'slide-down': 'slideDown 300ms ease-out',
        'scale-in': 'scaleIn 200ms ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'flow': 'flow 2s linear infinite',
        'bounce-in': 'bounceIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        flow: {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' }
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(0, 212, 255, 0.4)' }
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' }
        }
      },
      // Transitions
      transitionDuration: {
        'fast': '150ms',
        'normal': '250ms',
        'slow': '400ms'
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)'
      },
      // Background images for effects
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'vibe-gradient': 'linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
        'vibe-glow': 'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(0, 212, 255, 0.06), transparent 40%)'
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography')
  ]
};

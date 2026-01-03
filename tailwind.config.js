/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Vibeship-inspired color palette
      colors: {
        // Background colors - deep dark
        bg: {
          primary: '#050508',
          secondary: '#0a0a0f',
          tertiary: '#0f0f16',
          elevated: '#16161f',
          overlay: 'rgba(0, 0, 0, 0.8)'
        },
        // Surface colors
        surface: {
          DEFAULT: '#0f0f16',
          hover: '#16161f',
          active: '#1c1c26',
          border: '#1c1c26',
          'border-subtle': '#14141c'
        },
        // Text colors
        text: {
          primary: '#ffffff',
          secondary: '#8b8b9e',
          tertiary: '#4a4a5c',
          inverse: '#050508'
        },
        // Accent colors - Vibeship cyan/neon
        accent: {
          primary: '#00d4ff', // Vibeship cyan
          'primary-hover': '#33ddff',
          'primary-dim': '#00a8cc',
          secondary: '#a855f7', // Purple for secondary
          'secondary-hover': '#c084fc'
        },
        // Vibeship brand colors
        vibe: {
          cyan: '#00d4ff',
          'cyan-glow': 'rgba(0, 212, 255, 0.15)',
          'cyan-border': 'rgba(0, 212, 255, 0.3)',
          purple: '#a855f7',
          'purple-glow': 'rgba(168, 85, 247, 0.15)',
          green: '#22c55e',
          'green-glow': 'rgba(34, 197, 94, 0.15)'
        },
        // Category colors (for skill nodes)
        category: {
          development: '#22c55e', // Green
          integration: '#00d4ff', // Cyan
          ai: '#f59e0b', // Amber
          data: '#3b82f6', // Blue
          marketing: '#ec4899', // Pink
          strategy: '#14b8a6', // Teal
          agents: '#f97316', // Orange
          mind: '#a855f7' // Purple
        },
        // Status colors
        status: {
          success: '#22c55e',
          'success-bg': 'rgba(34, 197, 94, 0.1)',
          warning: '#eab308',
          'warning-bg': 'rgba(234, 179, 8, 0.1)',
          error: '#ef4444',
          'error-bg': 'rgba(239, 68, 68, 0.1)',
          info: '#00d4ff',
          'info-bg': 'rgba(0, 212, 255, 0.1)'
        },
        // Port type colors
        port: {
          text: '#22c55e',
          number: '#3b82f6',
          boolean: '#f59e0b',
          object: '#a855f7',
          array: '#ec4899',
          any: '#6b7280',
          skill: '#00d4ff'
        },
        // Ghost state
        ghost: {
          bg: 'rgba(0, 212, 255, 0.08)',
          border: 'rgba(0, 212, 255, 0.25)'
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
      // Shadows with cyan glow
      boxShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.4)',
        'DEFAULT': '0 4px 12px rgba(0, 0, 0, 0.5)',
        'lg': '0 8px 24px rgba(0, 0, 0, 0.6)',
        'xl': '0 12px 48px rgba(0, 0, 0, 0.7)',
        // Vibeship glow effects
        'glow-cyan': '0 0 20px rgba(0, 212, 255, 0.4)',
        'glow-cyan-lg': '0 0 40px rgba(0, 212, 255, 0.3)',
        'glow-cyan-intense': '0 0 30px rgba(0, 212, 255, 0.6), 0 0 60px rgba(0, 212, 255, 0.3)',
        'glow-purple': '0 0 20px rgba(168, 85, 247, 0.4)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.4)',
        'glow-error': '0 0 20px rgba(239, 68, 68, 0.4)',
        // Card glow on hover
        'card-glow': '0 0 0 1px rgba(0, 212, 255, 0.2), 0 0 20px rgba(0, 212, 255, 0.1)'
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

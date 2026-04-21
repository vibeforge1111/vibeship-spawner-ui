/** @type {import('tailwindcss').Config} */

// SPARK token references — channel triplets in src/app.css drive these.
// Using rgb(var(--x-rgb) / <alpha-value>) lets Tailwind opacity modifiers
// (bg-accent-primary/50) compose with theme vars.
const v = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: v('bg'),
          secondary: v('bg-subtle'),
          tertiary: v('surface'),
          elevated: v('surface-raised'),
          inverse: '#ffffff',
          overlay: 'rgba(0, 0, 0, 0.8)',
          subtle: v('bg-subtle'),
          raised: v('surface-raised')
        },
        surface: {
          DEFAULT: v('surface'),
          hover: v('bg-subtle'),
          active: v('surface-raised'),
          raised: v('surface-raised'),
          border: v('border'),
          'border-strong': v('border-strong')
        },
        text: {
          primary: v('text'),
          bright: v('text-bright'),
          secondary: v('text-secondary'),
          tertiary: v('text-tertiary'),
          ghost: v('text-ghost'),
          faint: v('text-faint'),
          inverse: v('bg')
        },
        accent: {
          DEFAULT: v('accent'),
          primary: v('accent'),
          'primary-hover': v('accent-hover'),
          'primary-dim': v('accent-hover'),
          fg: v('accent-fg'),
          secondary: v('iris'),
          'secondary-hover': v('iris')
        },
        iris: {
          DEFAULT: v('iris'),
          dim: v('iris-dim')
        },
        status: {
          success: v('status-green'),
          'success-bg': 'rgba(61, 221, 164, 0.1)',
          warning: v('status-amber'),
          'warning-bg': 'rgba(216, 200, 104, 0.1)',
          error: v('status-red'),
          'error-bg': 'rgba(224, 136, 120, 0.1)',
          info: v('accent'),
          'info-bg': 'rgba(47, 202, 148, 0.08)'
        },
        ghost: {
          bg: 'rgba(47, 202, 148, 0.08)',
          border: 'rgba(47, 202, 148, 0.25)'
        },
        // Skill node category coloring — restrained palette using accent + iris + neutrals
        category: {
          development: v('accent'),
          integration: v('accent'),
          ai: v('iris'),
          data: v('text-secondary'),
          marketing: v('iris'),
          strategy: v('accent'),
          agents: v('iris'),
          mind: v('iris')
        },
        port: {
          text: v('accent'),
          number: v('text-secondary'),
          boolean: v('status-amber'),
          object: v('iris'),
          array: v('iris-dim'),
          any: v('text-tertiary'),
          skill: v('accent')
        },
        vibe: {
          teal: v('accent'),
          'teal-glow': 'rgba(47, 202, 148, 0.15)',
          'teal-border': 'rgba(47, 202, 148, 0.3)',
          green: v('status-green'),
          'green-glow': 'rgba(61, 221, 164, 0.15)',
          violet: v('iris'),
          'violet-glow': 'rgba(184, 168, 220, 0.15)',
          orange: v('status-amber'),
          pink: v('iris'),
          blue: v('text-secondary')
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'JetBrains Mono', 'Consolas', 'monospace'],
        display: ['DM Sans', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif']
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
      borderRadius: {
        'none': '0',
        'sm': '3px',
        'DEFAULT': '5px',
        'md': '5px',
        'lg': '6px',
        'xl': '8px',
        'full': '9999px'
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.4)',
        'DEFAULT': '0 4px 12px rgba(0, 0, 0, 0.5)',
        'lg': '0 8px 24px rgba(0, 0, 0, 0.6)',
        'xl': '0 12px 48px rgba(0, 0, 0, 0.7)',
        'glow-teal': '0 0 20px rgba(47, 202, 148, 0.4)',
        'glow-teal-lg': '0 0 40px rgba(47, 202, 148, 0.3)',
        'glow-teal-intense': '0 0 30px rgba(47, 202, 148, 0.6), 0 0 60px rgba(47, 202, 148, 0.3)',
        'glow-green': '0 0 20px rgba(47, 202, 148, 0.3)',
        'glow-violet': '0 0 20px rgba(184, 168, 220, 0.4)',
        'glow-error': '0 0 20px rgba(224, 136, 120, 0.4)',
        'card-glow': '0 0 0 1px rgba(47, 202, 148, 0.2), 0 0 20px rgba(47, 202, 148, 0.1)'
      },
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
          '0%, 100%': { boxShadow: '0 0 20px rgba(47, 202, 148, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(47, 202, 148, 0.4)' }
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' }
        }
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '250ms',
        'slow': '400ms'
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'spark': 'cubic-bezier(0.23, 1, 0.32, 1)'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))'
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography')
  ]
};

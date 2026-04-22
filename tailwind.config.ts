import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        body:     ['var(--font-body)', 'system-ui', 'sans-serif'],
        display:  ['var(--font-display)', 'Georgia', 'serif'],
        headline: ['var(--font-display)', 'Georgia', 'serif'],
        code:     ['monospace'],
      },
      fontSize: {
        'eyebrow': ['11px', { lineHeight: '1', letterSpacing: '0.14em', fontWeight: '500' }],
      },
      letterSpacing: {
        'btn': '0.08em',
        'eyebrow': '0.14em',
      },
      colors: {
        /* ── shadcn semantic tokens ── */
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
          '6': 'hsl(var(--chart-6))',
        },
        sidebar: {
          DEFAULT:            'hsl(var(--sidebar-background))',
          foreground:         'hsl(var(--sidebar-foreground))',
          primary:            'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent:             'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border:             'hsl(var(--sidebar-border))',
          ring:               'hsl(var(--sidebar-ring))',
        },
        /* ── ByOlisJo named tokens (con soporte de opacidad) ── */
        'bj-canvas':       'hsl(var(--bj-canvas) / <alpha-value>)',
        'bj-surface':      'hsl(var(--bj-surface) / <alpha-value>)',
        'bj-elevated':     'hsl(var(--bj-elevated) / <alpha-value>)',
        'bj-sidebar':      'hsl(var(--bj-sidebar) / <alpha-value>)',
        'bj-row-alt':      'hsl(var(--bj-row-alt) / <alpha-value>)',
        'bj-hover':        'hsl(var(--bj-hover) / <alpha-value>)',
        'bj-brand':        'hsl(var(--bj-brand) / <alpha-value>)',
        'bj-brand-hover':  'hsl(var(--bj-brand-hover) / <alpha-value>)',
        'bj-premium':      'hsl(var(--bj-premium) / <alpha-value>)',
        'bj-positive':     'hsl(var(--bj-positive) / <alpha-value>)',
        'bj-negative':     'hsl(var(--bj-negative) / <alpha-value>)',
        'bj-warning':      'hsl(var(--bj-warning) / <alpha-value>)',
        'bj-info':         'hsl(var(--bj-info) / <alpha-value>)',
        'bj-text-primary':   'hsl(var(--bj-text-primary) / <alpha-value>)',
        'bj-text-secondary': 'hsl(var(--bj-text-secondary) / <alpha-value>)',
        'bj-text-tertiary':  'hsl(var(--bj-text-tertiary) / <alpha-value>)',
        'bj-text-on-dark':   'hsl(var(--bj-text-on-dark) / <alpha-value>)',
      },
      borderRadius: {
        lg:   '8px',
        md:   '4px',
        sm:   '2px',
        full: '9999px',
      },
      boxShadow: {
        'bj-card': '0 1px 4px 0 hsl(240 5% 8% / 0.06)',
        'bj-elevated': '0 2px 8px 0 hsl(240 5% 8% / 0.08)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;

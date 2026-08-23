/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Playfair Display', 'Georgia', 'serif'],
      },
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          light: 'var(--color-primary-light)',
          dark: 'var(--color-primary-hover)',
          hover: 'var(--color-primary-hover)',
        },
        teal: {
          DEFAULT: 'var(--color-teal)',
          light: 'var(--color-primary-light)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-primary-hover)',
        },
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          warm: 'var(--color-surface-warm)',
          dark: 'var(--color-surface-highlight)',
          highlight: 'var(--color-surface-highlight)',
        },
        fg: {
          DEFAULT: 'var(--color-foreground)',
          primary: 'var(--color-foreground)',
          secondary: 'var(--color-foreground-secondary)',
          muted: 'var(--color-foreground-muted)',
          dark: '#FFFFFF',
        },
        'text-primary': 'var(--color-foreground)',
        'text-secondary': 'var(--color-foreground-secondary)',
        'text-muted': 'var(--color-foreground-muted)',
        border: {
          DEFAULT: 'var(--color-border)',
          dark: 'var(--color-border)',
        },
        line: 'var(--color-border)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',
        ai: 'var(--color-ai)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: '999px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        hover: 'var(--shadow-hover)',
        subtle: 'var(--shadow-subtle)',
      },


    },
  },

  plugins: [],
}



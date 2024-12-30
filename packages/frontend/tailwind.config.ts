import { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';
import plugin from 'tailwindcss/plugin';
import tailwindContainerQuery from '@tailwindcss/container-queries';

const vitNodePlugin = plugin.withOptions(() => {
  return ({ addBase }) => {
    addBase({
      '.light .shiki code span': {
        color: 'var(--shiki-light)',
      },
      '.dark .shiki code span': {
        color: 'var(--shiki-dark)',
      },
      '.codeblock code': {
        display: 'grid',
        'font-size': '13px',
      },

      '.shiki code .diff.remove': {
        backgroundColor: 'var(--diff-remove-color)',
        opacity: '0.7',
      },
      '.shiki code .diff::before': {
        position: 'absolute',
        left: '6px',
      },
      '.shiki code .diff.remove::before': {
        content: "'-'",
        color: 'var(--diff-remove-symbol-color)',
      },
      '.shiki code .diff.add': {
        backgroundColor: 'var(--diff-add-color)',
      },
      '.shiki code .diff.add::before': {
        content: "'+'",
        color: 'var(--diff-add-symbol-color)',
      },
      '.shiki code .diff': {
        margin: '0 -16px',
        padding: '0 16px',
        position: 'relative',
      },
      '.shiki .highlighted': {
        margin: '0 -16px',
        padding: '0 16px',
        backgroundColor: `theme('colors.primary.DEFAULT / 10%')`,
      },
      '.shiki .highlighted-word': {
        padding: '1px 2px',
        margin: '-1px -3px',
        border: '1px solid',
        borderColor: `theme('colors.primary.DEFAULT / 50%')`,
        backgroundColor: `theme('colors.primary.DEFAULT / 10%')`,
        borderRadius: '2px',
      },
    });
  };
});

const config = {
  darkMode: ['class'],
  content: ['./src/components/**/*.{ts,tsx}'],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        cover: {
          DEFAULT: 'hsl(var(--cover))',
          foreground: 'hsl(var(--cover-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'rotateX(-30deg) scale(0.9)' },
          to: { opacity: '1', transform: 'rotateX(0deg) scale(1)' },
        },
        'scale-out': {
          from: { opacity: '1', transform: 'rotateX(0deg) scale(1)' },
          to: { opacity: '0', transform: 'rotateX(-10deg) scale(0.95)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'scale-in': 'scale-in 200ms ease',
        'scale-out': 'scale-in 200ms ease',
      },
    },
  },
  plugins: [tailwindcssAnimate, tailwindContainerQuery, vitNodePlugin],
} satisfies Config;

export default config;

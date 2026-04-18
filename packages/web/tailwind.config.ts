import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        accent: {
          DEFAULT: '#6366f1',
          light: '#a5b4fc',
          dim: 'rgba(99, 102, 241, 0.12)',
          2: '#8b5cf6',
        },
        surface: {
          DEFAULT: '#101014',
          2: '#16161c',
          3: '#1d1d25',
        },
        ink: {
          DEFAULT: '#f4f4f5',
          soft: '#d4d4d8',
          muted: '#a1a1aa',
          subtle: '#52525b',
        },
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.03em',
        tight: '-0.02em',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
      },
      boxShadow: {
        soft: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.6)',
        glow: '0 10px 28px -10px rgba(99, 102, 241, 0.5)',
      },
    },
  },
  plugins: [],
};

export default config;

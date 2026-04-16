import type { Config } from 'tailwindcss';

// OrangeBench Design System v2.0
// Source of truth: CLAUDE.md in repo root
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─── v1.2 canonical tokens (legacy, kept for compat) ───
        ob: {
          bg: '#141417',
          surface: '#1D1D20',
          'surface-hi': '#26262A',
          border: '#2F2F34',
          'border-strong': '#42424A',
          text: '#F5F5F0',
          'text-muted': '#8A8A90',
          'text-dim': '#5A5A60',
          orange: '#FF5A1F',
          'orange-hi': '#FF7340',
          'orange-lo': '#D9471A',
          success: '#C9B89E',
          warning: '#D4A017',
          error: '#E4483D',
          info: '#9A9591',
        },

        // ─── v2.0 design system tokens ─────────────────────────
        primary: '#FF5A1F',
        background: '#0C0C0A',
        surface: {
          DEFAULT: '#111110',
          raised: '#1A1A18',
          overlay: '#222220',
          // Legacy aliases
          primary: 'var(--ob-bg)',
          secondary: 'var(--ob-surface)',
          tertiary: 'var(--ob-surface-hi)',
        },
        border: {
          DEFAULT: '#1F1F1D',
          subtle: '#2A2A27',
          strong: '#3A3A35',
        },
        'text-primary': '#F5F5F4',
        'text-muted': '#A8A29E',
        'text-subtle': '#6B6560',

        // ─── Accent variants ───────────────────────────────────
        'accent-hover': '#FF6B35',
        'accent-muted': 'rgba(255,90,31,0.10)',

        // ─── Semantic ──────────────────────────────────────────
        success: '#34D399',
        warning: '#FBBF24',
        danger: '#F87171',
        info: '#60A5FA',

        // ─── Legacy aliases (backward compat) ──────────────────
        accent: {
          DEFAULT: '#FF5A1F',
          hover: '#D9471A',
          light: '#FF7340',
          dim: '#D9471A',
        },
        content: {
          primary: 'var(--ob-text)',
          secondary: 'var(--ob-text-muted)',
          tertiary: 'var(--ob-text-dim)',
        },
      },
      fontFamily: {
        display: [
          'Cabinet Grotesk',
          'General Sans',
          'system-ui',
          'sans-serif',
        ],
        sans: [
          'Geist',
          'HarmonyOS Sans SC',
          'Noto Sans SC',
          '-apple-system',
          'BlinkMacSystemFont',
          'PingFang SC',
          'sans-serif',
        ],
        mono: [
          'Geist Mono',
          'SF Mono',
          'ui-monospace',
          'monospace',
        ],
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        // Legacy aliases
        'ob-input': '4px',
        'ob-btn': '8px',
        'ob-card': '12px',
        'ob-card-lg': '16px',
      },
      transitionDuration: {
        fast: '100ms',
        base: '150ms',
        slow: '300ms',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'ob-out': 'cubic-bezier(.2,.7,.3,1)',
        'ob-in-out': 'cubic-bezier(.4,0,.2,1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;

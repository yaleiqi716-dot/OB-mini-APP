import type { Config } from 'tailwindcss';

// OrangeBench Design System v1.2
// Source of truth: DESIGN.md in repo root
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─── v1.2 canonical tokens ─────────────────────────────
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
          success: '#C9B89E',  // warm sand — NOT green
          warning: '#D4A017',  // mustard
          error: '#E4483D',    // rust red
          info: '#9A9591',     // warm stone — NOT blue
        },

        // ─── Legacy aliases (backward compat) ──────────────────
        // `accent-*` now resolves to OrangeBench Orange #FF5A1F.
        // Do NOT use this in new code — use `ob-orange` instead.
        accent: {
          DEFAULT: '#FF5A1F',
          hover: '#D9471A',
          light: '#FF7340',
          dim: '#D9471A',
        },
        surface: {
          primary: 'var(--ob-bg)',
          secondary: 'var(--ob-surface)',
          tertiary: 'var(--ob-surface-hi)',
        },
        content: {
          primary: 'var(--ob-text)',
          secondary: 'var(--ob-text-muted)',
          tertiary: 'var(--ob-text-dim)',
        },
        border: {
          DEFAULT: 'var(--ob-border)',
        },
      },
      fontFamily: {
        // Display: Cabinet Grotesk (Fontshare), used for hero, wordmark, H1-H3
        display: [
          'Cabinet Grotesk',
          'General Sans',
          'system-ui',
          'sans-serif',
        ],
        // Body: Geist (Google Fonts / Vercel), used for UI text
        sans: [
          'Geist',
          'HarmonyOS Sans SC',
          'Noto Sans SC',
          '-apple-system',
          'BlinkMacSystemFont',
          'PingFang SC',
          'sans-serif',
        ],
        // Mono: Geist Mono, used for data tables, timestamps, code, tabular nums
        mono: [
          'Geist Mono',
          'SF Mono',
          'ui-monospace',
          'monospace',
        ],
      },
      borderRadius: {
        'ob-input': '4px',
        'ob-btn': '8px',
        'ob-card': '12px',
        'ob-card-lg': '16px',
      },
      transitionTimingFunction: {
        'ob-out': 'cubic-bezier(.2,.7,.3,1)',
        'ob-in-out': 'cubic-bezier(.4,0,.2,1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;

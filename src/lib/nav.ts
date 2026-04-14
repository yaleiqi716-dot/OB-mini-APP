// Shared top navigation links — single source of truth
// All subpages import this array. Do not duplicate in individual pages.
//
// Updated 2026-04-09 — collapsed from 7 → 4 items per the PM audit.
// Rationale: /tasks, /dashboard, /review all queried the same underlying
// task data with different filters, but new users couldn't distinguish
// "总览" vs "任务" vs "处理" from the labels alone. /settings and
// /account both carried user config and overlapped with /profile and
// /billing. Seven flat destinations were not a hierarchy — they were a
// tombstone. This new shape is:
//
//   AGENT   — the main interaction surface (AI composer)
//   任务    — unified task list with tabs (replaces /tasks + /review + /dashboard)
//   工作区  — team coordination surface (unchanged)
//   账户    — all user-level settings (account + billing + profile + settings)
//
// The retired pages (/dashboard /review /settings /profile /billing)
// still exist and are reachable via direct URL — they're just not in
// the top nav anymore. They can be consolidated later behind /account
// or removed once they're confirmed unused.

export const MAIN_NAV = [
  { href: '/agent', label: 'AGENT' },
  { href: '/tasks', label: '任务' },
  { href: '/workspace', label: '工作区' },
  { href: '/account', label: '账户' },
] as const;

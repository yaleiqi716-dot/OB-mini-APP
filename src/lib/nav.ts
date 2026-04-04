// Shared top navigation links — single source of truth
// All subpages import this array. Do not duplicate in individual pages.

export const MAIN_NAV = [
  { href: '/agent', label: 'AGENT' },
  { href: '/tasks', label: '任务' },
  { href: '/dashboard', label: '总览' },
  { href: '/review', label: '处理' },
  { href: '/workspace', label: '工作区' },
  { href: '/settings', label: '设置' },
  { href: '/account', label: '账户' },
] as const;

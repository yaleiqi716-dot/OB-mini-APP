import { getMessages } from '@/lib/i18n';

const t = getMessages('zh-CN');

export type MainNavItem = {
  href: string;
  label: string;
  deprecated?: boolean;
};

export const MAIN_NAV = [
  { href: '/agent', label: t.nav.agent },
  { href: '/workspace', label: t.nav.workspace },
  { href: '/studio', label: t.nav.studio },
  { href: '/cloud-browser', label: t.nav.cloudBrowser },
  { href: '/account', label: t.nav.appCenter },
  { href: '/tasks', label: t.nav.projects },
  { href: '/billing', label: t.nav.pricing, deprecated: true },
  { href: '/settings', label: t.nav.settings, deprecated: true },
] satisfies readonly MainNavItem[];

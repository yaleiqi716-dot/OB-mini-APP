'use client';

import { usePathname } from 'next/navigation';

const WS_NAV = [
  { href: '/workspace', label: '看板' },
  { href: '/workspace/members', label: '成员' },
  { href: '/workspace/settings', label: '设置' },
];

export function WorkspaceHeader() {
  const pathname = usePathname();

  // Determine which workspace nav item is active
  const isWsPage = pathname.startsWith('/workspace');
  const activeWsHref = WS_NAV.find(n => pathname === n.href)?.href
    || (pathname.startsWith('/workspace/tasks') ? '/workspace' : null);

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 52, padding: '0 32px',
      borderBottom: '1px solid #E7E5E1',
      background: '#F7F7F4', flexShrink: 0,
    }}>
      <a href="/agent" style={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}>
        <span style={{ color: '#F97316', fontWeight: 700, fontSize: 15 }}>ORANGE</span>
        <span style={{ color: '#171717', fontWeight: 700, fontSize: 15 }}>BENCH</span>
      </a>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Global nav */}
        {[
          { href: '/agent', label: 'AGENT' },
          { href: '/tasks', label: '任务' },
          { href: '/dashboard', label: '总览' },
          { href: '/review', label: '处理' },
        ].map(n => (
          <a key={n.href} href={n.href} style={{
            fontSize: 13, textDecoration: 'none', padding: '4px 10px', borderRadius: 8,
            color: '#9CA3AF', transition: 'color .2s',
          }}>{n.label}</a>
        ))}

        {/* Workspace — highlighted when on any /workspace page */}
        <a href="/workspace" style={{
          fontSize: 13, fontWeight: isWsPage ? 600 : 400,
          color: isWsPage ? '#F97316' : '#9CA3AF',
          textDecoration: 'none', padding: '4px 10px', borderRadius: 8,
          background: isWsPage ? 'rgba(255,122,26,0.10)' : 'transparent',
          transition: 'color .2s',
        }}>工作区</a>

        {[
          { href: '/settings', label: '设置' },
          { href: '/account', label: '账户' },
        ].map(n => (
          <a key={n.href} href={n.href} style={{
            fontSize: 13, textDecoration: 'none', padding: '4px 10px', borderRadius: 8,
            color: '#9CA3AF', transition: 'color .2s',
          }}>{n.label}</a>
        ))}
      </nav>
    </header>
  );
}

// Sub-nav for workspace pages (shown below header on workspace pages)
export function WorkspaceSubNav() {
  const pathname = usePathname();
  const activeHref = WS_NAV.find(n => pathname === n.href)?.href
    || (pathname.startsWith('/workspace/tasks') ? '/workspace' : null);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 32px', height: 40,
      borderBottom: '1px solid #F0EDE8',
      background: '#F7F7F4',
    }}>
      {WS_NAV.map(n => {
        const active = n.href === activeHref;
        return (
          <a key={n.href} href={n.href} style={{
            fontSize: 13, fontWeight: active ? 500 : 400,
            color: active ? '#171717' : '#9CA3AF',
            textDecoration: 'none', padding: '6px 12px', borderRadius: 8,
            background: active ? 'rgba(0,0,0,0.03)' : 'transparent',
            transition: 'all .2s',
          }}>{n.label}</a>
        );
      })}
    </div>
  );
}

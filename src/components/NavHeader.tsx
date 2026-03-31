'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_LINKS = [
  { href: '/agent', label: 'Agent' },
  { href: '/dashboard', label: '决策台' },
  { href: '/tasks', label: '我的任务' },
  { href: '/review', label: '审核' },
  { href: '/billing', label: '充值' },
];

export function NavHeader({ brand = true }: { brand?: boolean }) {
  const pathname = usePathname();
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 48, padding: '0 20px', borderBottom: '1px solid var(--border)',
      background: 'var(--bg)', flexShrink: 0,
    }}>
      {brand && (
        <Link href="/agent" style={{ display: 'flex', alignItems: 'center', gap: 0, textDecoration: 'none' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14 }}>ORANGE</span>
          <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 14 }}>BENCH</span>
        </Link>
      )}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href || (href !== '/agent' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              style={{
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--accent)' : 'var(--text-faint)',
                textDecoration: 'none',
                padding: '4px 10px',
                borderRadius: 8,
                background: active ? 'var(--accent-subtle)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

const NAV_LINKS = [
  { href: '/agent', label: 'Agent' },
  { href: '/dashboard', label: '决策台' },
  { href: '/tasks', label: '我的任务' },
  { href: '/review', label: '审核' },
  { href: '/billing', label: '充值' },
];

export function NavHeader({ brand = true }: { brand?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const m = document.cookie.match(/ob-user-id=([^;]+)/);
    if (m?.[1]) setUserId(decodeURIComponent(m[1]));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  function handleLogout() {
    document.cookie = 'ob-user-id=; path=/; max-age=0';
    router.replace('/login');
  }

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 48, padding: '0 20px', borderBottom: '1px solid var(--border)',
      background: 'var(--bg)', flexShrink: 0, position: 'relative', zIndex: 50,
    }}>
      {brand && (
        <Link href="/agent" style={{ display: 'flex', alignItems: 'center', gap: 0, textDecoration: 'none' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14 }}>ORANGE</span>
          <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 14 }}>BENCH</span>
        </Link>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

        {/* User avatar with dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--accent)', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-label="用户菜单"
          >
            {userId ? userId.slice(0, 1).toUpperCase() : 'U'}
          </button>

          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 38, right: 0,
              background: 'var(--bg-secondary, #1e1e1e)',
              border: '1px solid var(--border)',
              borderRadius: 12, padding: '6px 0',
              minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              zIndex: 100,
            }}>
              <div style={{ padding: '8px 14px 10px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                  {userId || '未登录'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>当前用户</div>
              </div>
              <DropdownLink href="/profile" label="个人资料" icon="user" onClick={() => setDropdownOpen(false)} />
              <DropdownLink href="/settings" label="设置" icon="settings" onClick={() => setDropdownOpen(false)} />
              <DropdownLink href="/billing" label="充值与套餐" icon="billing" onClick={() => setDropdownOpen(false)} />
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <button
                onClick={handleLogout}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '8px 14px', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 13, color: '#f87171',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function DropdownLink({ href, label, icon, onClick }: { href: string; label: string; icon: string; onClick: () => void }) {
  const icons: Record<string, React.ReactNode> = {
    user: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    settings: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 0-14.14 0"/><path d="M4.93 19.07a10 10 0 0 0 14.14 0"/><path d="M2 12h2M20 12h2M12 2v2M12 20v2"/></svg>,
    billing: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  };
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', fontSize: 13,
        color: 'var(--text)', textDecoration: 'none',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {icons[icon]}
      {label}
    </Link>
  );
}

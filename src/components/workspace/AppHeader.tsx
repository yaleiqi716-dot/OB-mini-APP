'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { MAIN_NAV } from '@/lib/nav';

const WS_NAV = [
  { href: '/workspace', label: '看板' },
  { href: '/workspace/members', label: '成员' },
  { href: '/workspace/settings', label: '设置' },
];

// Account center sub-nav — unifies /account, /profile, /billing,
// /settings into a single "account center" with 4 tabs. Each tab
// still lives at its own URL (the underlying pages are untouched)
// but the shared tab bar makes them feel like one destination.
// Inserted below AppHeader on each of the 4 pages.
const ACCOUNT_NAV = [
  { href: '/account', label: '概览' },
  { href: '/profile', label: '个人资料' },
  { href: '/billing', label: '订阅 & 账单' },
  { href: '/account/integrations', label: '集成 · Webhook' },
  { href: '/settings', label: '偏好设置' },
];

interface NotifItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  return `${Math.floor(hrs / 24)}天前`;
}

// Re-export old name for backward compat during transition
export const WorkspaceHeader = AppHeader;

export function AppHeader() {
  const pathname = usePathname();

  function isNavActive(href: string): boolean {
    if (href === '/agent') return pathname === '/agent';
    if (href === '/workspace') return pathname.startsWith('/workspace');
    return pathname === href || pathname.startsWith(href + '/');
  }

  // Notification state
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count on mount + every 30s
  const fetchCount = useCallback(() => {
    fetch('/api/notifications/unread-count').then(r => r.json()).then(d => {
      if (typeof d.count === 'number') setUnreadCount(d.count);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchCount();
    const iv = setInterval(fetchCount, 30000);
    return () => clearInterval(iv);
  }, [fetchCount]);

  // Fetch notifications when dropdown opens
  function handleToggle() {
    const next = !dropdownOpen;
    setDropdownOpen(next);
    if (next && !loadedOnce) {
      fetch('/api/notifications').then(r => r.json()).then(d => {
        if (Array.isArray(d)) setNotifications(d.slice(0, 10));
        setLoadedOnce(true);
      }).catch(() => {});
    }
  }

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  async function handleMarkAllRead() {
    await fetch('/api/notifications/mark-read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function handleClickNotif(n: NotifItem) {
    if (!n.read) {
      fetch('/api/notifications/mark-read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) }).catch(() => {});
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    if (n.linkUrl) window.location.href = n.linkUrl;
    setDropdownOpen(false);
  }

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 56, padding: '0 28px',
      borderBottom: '1px solid var(--ob-border)',
      background: 'var(--ob-bg)', flexShrink: 0,
      fontFamily: 'var(--ob-font-body)',
    }}>
      <a href="/agent" style={{ display: 'flex', alignItems: 'center', gap: 0, textDecoration: 'none' }}>
        <span style={{ fontFamily: 'var(--ob-font-display)', color: 'var(--ob-orange)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>ORANGE</span>
        <span style={{ fontFamily: 'var(--ob-font-display)', color: 'var(--ob-text)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>BENCH</span>
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {MAIN_NAV.map(n => {
            const active = isNavActive(n.href);
            return (
              <a key={n.href} href={n.href} style={{
                fontSize: 13, textDecoration: 'none', padding: '7px 12px', borderRadius: 6,
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--ob-text)' : 'var(--ob-text-muted)',
                background: 'transparent',
                transition: 'color .12s cubic-bezier(.2,.7,.3,1)',
                position: 'relative',
                fontFamily: 'var(--ob-font-body)',
              }}>
                {n.label}
                {active && (
                  <span style={{
                    position: 'absolute', bottom: -1, left: '50%', transform: 'translateX(-50%)',
                    width: 14, height: 2, borderRadius: 1,
                    background: 'var(--ob-orange)',
                    boxShadow: '0 0 8px rgba(255,90,31,0.5)',
                  }} />
                )}
              </a>
            );
          })}
        </nav>

        {/* Notification bell */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={handleToggle}
            aria-label="通知"
            style={{
              width: 34, height: 34, borderRadius: 6, border: '1px solid transparent',
              background: dropdownOpen ? 'var(--ob-surface-hi)' : 'transparent',
              borderColor: dropdownOpen ? 'var(--ob-border)' : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', transition: 'all .15s cubic-bezier(.2,.7,.3,1)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dropdownOpen ? 'var(--ob-orange)' : 'var(--ob-text-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                width: unreadCount > 9 ? 16 : 7, height: 7,
                borderRadius: 2,
                background: 'var(--ob-orange)',
                boxShadow: '0 0 8px rgba(255,90,31,0.5), 0 0 2px rgba(255,90,31,0.8)',
                color: '#fff', fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1, fontFamily: 'var(--ob-font-mono)',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount > 1 ? unreadCount : ''}
              </span>
            )}
          </button>

          {/* Dropdown panel — token-driven */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 42, right: 0,
              width: 360, maxHeight: 440, overflowY: 'auto',
              background: 'var(--ob-surface)', border: '1px solid var(--ob-border)',
              borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              zIndex: 100,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 12px', borderBottom: '1px solid var(--ob-border)' }}>
                <span style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ob-text-muted)' }}>
                  <span style={{ color: 'var(--ob-orange)' }}>●</span> 通知
                </span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ob-orange)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    全部已读
                  </button>
                )}
              </div>

              {/* List */}
              {notifications.length === 0 ? (
                <div style={{ padding: '36px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--ob-text-muted)', fontFamily: 'var(--ob-font-body)' }}>暂无通知</p>
                </div>
              ) : (
                <div>
                  {notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => handleClickNotif(n)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '14px 18px', border: 'none', borderBottom: '1px solid var(--ob-border)',
                        background: n.read ? 'transparent' : 'var(--ob-orange-a10, rgba(255,90,31,0.06))',
                        cursor: 'pointer', textAlign: 'left', transition: 'background .15s',
                        fontFamily: 'var(--ob-font-body)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--ob-surface-hi)')}
                      onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'var(--ob-orange-a10, rgba(255,90,31,0.06))')}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                        background: n.read ? 'transparent' : 'var(--ob-orange)',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: 'var(--ob-text)', margin: '0 0 3px', lineHeight: 1.45 }}>{n.title}</p>
                        {n.body && <p style={{ fontSize: 12, color: 'var(--ob-text-muted)', margin: '0 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</p>}
                        <span style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 10, letterSpacing: '0.06em', color: 'var(--ob-text-dim)' }}>{timeAgo(n.createdAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// Sub-nav for account center pages (/account, /profile, /billing, /settings).
// Inserted below AppHeader on each page to visually unify them as a single
// "account center" without requiring a risky merge of the 4 underlying pages.
export function AccountSubNav() {
  const pathname = usePathname();
  const activeHref = ACCOUNT_NAV.find(n => pathname === n.href)?.href || null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '0 28px', height: 42,
      borderBottom: '1px solid var(--ob-border)',
      background: 'var(--ob-bg)',
      fontFamily: 'var(--ob-font-body)',
    }}>
      {ACCOUNT_NAV.map(n => {
        const active = n.href === activeHref;
        return (
          <a key={n.href} href={n.href} style={{
            fontSize: 13, fontWeight: active ? 600 : 500,
            color: active ? 'var(--ob-text)' : 'var(--ob-text-muted)',
            textDecoration: 'none', padding: '7px 14px', borderRadius: 6,
            background: active ? 'var(--ob-surface-hi)' : 'transparent',
            transition: 'all .15s cubic-bezier(.2,.7,.3,1)',
          }}>{n.label}</a>
        );
      })}
    </div>
  );
}

// Sub-nav for workspace pages
export function WorkspaceSubNav() {
  const pathname = usePathname();
  const activeHref = WS_NAV.find(n => pathname === n.href)?.href
    || (pathname.startsWith('/workspace/tasks') ? '/workspace' : null);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '0 28px', height: 42,
      borderBottom: '1px solid var(--ob-border)',
      background: 'var(--ob-bg)',
      fontFamily: 'var(--ob-font-body)',
    }}>
      {WS_NAV.map(n => {
        const active = n.href === activeHref;
        return (
          <a key={n.href} href={n.href} style={{
            fontSize: 13, fontWeight: active ? 600 : 500,
            color: active ? 'var(--ob-text)' : 'var(--ob-text-muted)',
            textDecoration: 'none', padding: '7px 14px', borderRadius: 6,
            background: active ? 'var(--ob-surface-hi)' : 'transparent',
            transition: 'all .15s cubic-bezier(.2,.7,.3,1)',
          }}>{n.label}</a>
        );
      })}
    </div>
  );
}

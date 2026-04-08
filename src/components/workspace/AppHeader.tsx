'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { MAIN_NAV } from '@/lib/nav';

const WS_NAV = [
  { href: '/workspace', label: '看板' },
  { href: '/workspace/members', label: '成员' },
  { href: '/workspace/settings', label: '设置' },
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
      height: 52, padding: '0 32px',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      background: '#1A1816', flexShrink: 0,
    }}>
      <a href="/agent" style={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}>
        <span style={{ color: '#FF5A1F', fontWeight: 700, fontSize: 15, textShadow: '0 0 12px rgba(255,90,31,0.3)' }}>ORANGE</span>
        <span style={{ color: '#E0D8D0', fontWeight: 700, fontSize: 15 }}>BENCH</span>
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {MAIN_NAV.map(n => {
            const active = isNavActive(n.href);
            return (
              <a key={n.href} href={n.href} style={{
                fontSize: 13, textDecoration: 'none', padding: '6px 10px', borderRadius: 8,
                fontWeight: active ? 600 : 400,
                color: active ? '#FF5A1F' : '#888888',
                background: active ? 'rgba(255,90,31,0.08)' : 'transparent',
                transition: 'color .12s, background .12s',
                position: 'relative',
              }}>
                {n.label}
                {/* Signal lamp — active nav indicator */}
                {active && (
                  <span style={{
                    position: 'absolute', bottom: -1, left: '50%', transform: 'translateX(-50%)',
                    width: 12, height: 2, borderRadius: 1,
                    background: '#FF5A1F',
                    boxShadow: '0 0 18px rgba(255,90,31,0.22)',
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
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: dropdownOpen ? 'rgba(255,90,31,0.10)' : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', transition: 'background .2s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dropdownOpen ? '#FF5A1F' : '#CCCCCC'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 3, right: 3,
                width: unreadCount > 9 ? 16 : 7, height: 7,
                borderRadius: 2,
                background: '#FF5A1F',
                boxShadow: '0 0 8px rgba(255,90,31,0.5), 0 0 2px rgba(255,90,31,0.8)',
                color: '#fff', fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}>
                {unreadCount > 9 ? '9+' : unreadCount > 1 ? unreadCount : ''}
              </span>
            )}
          </button>

          {/* Dropdown panel */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 40, right: 0,
              width: 340, maxHeight: 420, overflowY: 'auto',
              background: '#252321', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              zIndex: 100,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#E0D8D0' }}>通知</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} style={{ fontSize: 12, color: '#FF5A1F', background: 'none', border: 'none', cursor: 'pointer' }}>
                    全部已读
                  </button>
                )}
              </div>

              {/* List */}
              {notifications.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'rgba(224,216,208,0.55)' }}>暂无通知</p>
                </div>
              ) : (
                <div>
                  {notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => handleClickNotif(n)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '12px 16px', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: n.read ? 'transparent' : 'rgba(255,90,31,0.04)',
                        cursor: 'pointer', textAlign: 'left', transition: 'background .15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(255,90,31,0.04)')}
                    >
                      {/* Unread dot */}
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                        background: n.read ? 'transparent' : '#FF5A1F',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: n.read ? 400 : 500, color: '#E0D8D0', margin: '0 0 2px', lineHeight: 1.4 }}>{n.title}</p>
                        {n.body && <p style={{ fontSize: 12, color: 'rgba(224,216,208,0.28)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</p>}
                        <span style={{ fontSize: 11, color: 'rgba(224,216,208,0.55)' }}>{timeAgo(n.createdAt)}</span>
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

// Sub-nav for workspace pages
export function WorkspaceSubNav() {
  const pathname = usePathname();
  const activeHref = WS_NAV.find(n => pathname === n.href)?.href
    || (pathname.startsWith('/workspace/tasks') ? '/workspace' : null);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 32px', height: 40,
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      background: '#1A1816',
    }}>
      {WS_NAV.map(n => {
        const active = n.href === activeHref;
        return (
          <a key={n.href} href={n.href} style={{
            fontSize: 13, fontWeight: active ? 500 : 400,
            color: active ? '#F5F5F5' : '#888888',
            textDecoration: 'none', padding: '6px 12px', borderRadius: 8,
            background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
            transition: 'all .2s',
          }}>{n.label}</a>
        );
      })}
    </div>
  );
}

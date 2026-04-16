'use client';
import { useEffect, useState } from 'react';
import { AppHeader, AccountSubNav } from '@/components/workspace/AppHeader';
import { Spinner } from '@/components/ui/Spinner';

interface UserInfo {
  id: string;
  credits: number;
  plan: string;
  expireAt: string | null;
  limits: { maxConcurrent: number; allowedTypes: string[]; dailyCredits: number; monthlyCredits: number };
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const m = document.cookie.match(/ob-user-id=([^;]+)/);
    if (m?.[1]) setUserId(decodeURIComponent(m[1]));
    fetch('/api/user')
      .then(r => r.json())
      .then(d => { if (d.id) setUser(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--ob-bg)', fontFamily: 'var(--ob-font-body)' }}>
      <AppHeader />
      <AccountSubNav />
      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 32px 60px' }}>
          {/* Editorial kicker + display h1 */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ob-text-muted)', margin: '0 0 8px' }}>
              <span style={{ color: 'var(--ob-orange)' }}>●</span> Profile
            </p>
            <h1 style={{ fontFamily: 'var(--ob-font-display)', fontSize: 44, fontWeight: 800, color: 'var(--ob-text)', lineHeight: 1, letterSpacing: '-0.025em', margin: 0 }}>个人资料</h1>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}><Spinner size="md" /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Avatar + basic info — hero card uses 16px radius */}
              <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: '#1A1A18', padding: 24, display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'rgba(255,90,31,0.18)', color: '#FF5A1F',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700, flexShrink: 0,
                  fontFamily: 'var(--ob-font-display)',
                }}>
                  {userId ? userId.slice(0, 1).toUpperCase() : 'U'}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ob-text)' }}>{userId || '未知用户'}</div>
                  <div style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 11, color: 'var(--ob-text-dim)', marginTop: 4, letterSpacing: '0.04em' }}>
                    USER ID &middot; {user?.id || userId}
                  </div>
                </div>
              </div>

              {/* Plan & credits — body card uses 12px radius */}
              <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: '#1A1A18', padding: '20px 24px' }}>
                <p style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 12, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(245,245,240,0.35)', margin: '0 0 16px' }}>账户状态</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ob-text-dim)', marginBottom: 4, fontFamily: 'var(--ob-font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>当前套餐</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ob-text)', textTransform: 'uppercase', fontFamily: 'var(--ob-font-display)' }}>{user?.plan || 'Free'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ob-text-dim)', marginBottom: 4, fontFamily: 'var(--ob-font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>剩余额度</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#FF5A1F', fontFamily: 'var(--ob-font-mono)' }}>{user?.credits ?? '--'} <span style={{ fontSize: 12, color: 'rgba(245,245,240,0.35)' }}>credits</span></div>
                  </div>
                  {user?.expireAt && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--ob-text-dim)', marginBottom: 4, fontFamily: 'var(--ob-font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>到期时间</div>
                      <div style={{ fontSize: 13, color: 'var(--ob-text)' }}>{new Date(user.expireAt).toLocaleDateString('zh-CN')}</div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ob-text-dim)', marginBottom: 4, fontFamily: 'var(--ob-font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>最大并发任务</div>
                    <div style={{ fontSize: 13, color: 'var(--ob-text)' }}>{user?.limits?.maxConcurrent ?? '--'} 个</div>
                  </div>
                </div>
              </div>

              {/* Quick links — body card 12px */}
              <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: '#1A1A18', padding: '20px 24px' }}>
                <p style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(245,245,240,0.35)', margin: '0 0 12px' }}>快捷操作</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {[
                    { href: '/billing', label: '充值与套餐' },
                    { href: '/tasks', label: '我的任务' },
                    { href: '/settings', label: '账户设置' },
                  ].map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', borderRadius: 8,
                        color: 'var(--ob-text)', textDecoration: 'none',
                        transition: 'background .12s cubic-bezier(.2,.7,.3,1)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ob-surface-hi)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ fontSize: 14 }}>{link.label}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ob-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

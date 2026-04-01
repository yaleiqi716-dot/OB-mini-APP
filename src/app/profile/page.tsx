'use client';
import { useEffect, useState } from 'react';
import { NavHeader } from '@/components/NavHeader';
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
    <div className="h-[100dvh] flex flex-col bg-surface-primary">
      <NavHeader />
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-6">
          <h1 className="text-xl font-semibold text-content-primary">个人资料</h1>

          {loading ? (
            <div className="flex justify-center py-12"><Spinner size="md" /></div>
          ) : (
            <>
              {/* Avatar + basic info */}
              <div className="rounded-2xl border border-border bg-surface-secondary p-6 flex items-center gap-5">
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 700, flexShrink: 0,
                }}>
                  {userId ? userId.slice(0, 1).toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="text-base font-semibold text-content-primary">{userId || '未知用户'}</div>
                  <div className="text-xs text-content-tertiary mt-1">用户 ID：{user?.id || userId}</div>
                </div>
              </div>

              {/* Plan & credits */}
              <div className="rounded-2xl border border-border bg-surface-secondary p-6 space-y-4">
                <h2 className="text-sm font-semibold text-content-primary">账户状态</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-content-tertiary mb-1">当前套餐</div>
                    <div className="text-lg font-bold text-content-primary uppercase">{user?.plan || 'Free'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-content-tertiary mb-1">剩余额度</div>
                    <div className="text-lg font-bold text-accent">{user?.credits ?? '--'} credits</div>
                  </div>
                  {user?.expireAt && (
                    <div>
                      <div className="text-xs text-content-tertiary mb-1">到期时间</div>
                      <div className="text-sm text-content-primary">{new Date(user.expireAt).toLocaleDateString('zh-CN')}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-content-tertiary mb-1">最大并发任务</div>
                    <div className="text-sm text-content-primary">{user?.limits?.maxConcurrent ?? '--'} 个</div>
                  </div>
                </div>
              </div>

              {/* Quick links */}
              <div className="rounded-2xl border border-border bg-surface-secondary p-6 space-y-3">
                <h2 className="text-sm font-semibold text-content-primary">快捷操作</h2>
                <div className="space-y-2">
                  <a href="/billing" className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-tertiary transition-colors">
                    <span className="text-sm text-content-primary">充值与套餐</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-content-tertiary">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </a>
                  <a href="/tasks" className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-tertiary transition-colors">
                    <span className="text-sm text-content-primary">我的任务</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-content-tertiary">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </a>
                  <a href="/settings" className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-tertiary transition-colors">
                    <span className="text-sm text-content-primary">账户设置</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-content-tertiary">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

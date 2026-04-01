'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';

export default function SettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    const m = document.cookie.match(/ob-user-id=([^;]+)/);
    if (m?.[1]) setUserId(decodeURIComponent(m[1]));
  }, []);

  function handleLogout() {
    document.cookie = 'ob-user-id=; path=/; max-age=0';
    router.replace('/login');
  }

  function handleClearData() {
    showToast('本地缓存已清除', true);
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-surface-primary">
      <NavHeader />
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-6">
          <h1 className="text-xl font-semibold text-content-primary">设置</h1>

          {/* Account section */}
          <div className="rounded-2xl border border-border bg-surface-secondary overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50">
              <h2 className="text-xs font-semibold text-content-tertiary uppercase tracking-wide">账户</h2>
            </div>
            <div className="divide-y divide-border/30">
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="text-sm font-medium text-content-primary">当前用户</div>
                  <div className="text-xs text-content-tertiary mt-0.5">{userId || '未登录'}</div>
                </div>
              </div>
              <a href="/profile" className="flex items-center justify-between px-5 py-4 hover:bg-surface-tertiary transition-colors">
                <div className="text-sm text-content-primary">个人资料</div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-content-tertiary">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </a>
              <a href="/billing" className="flex items-center justify-between px-5 py-4 hover:bg-surface-tertiary transition-colors">
                <div className="text-sm text-content-primary">充值与套餐</div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-content-tertiary">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Data section */}
          <div className="rounded-2xl border border-border bg-surface-secondary overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50">
              <h2 className="text-xs font-semibold text-content-tertiary uppercase tracking-wide">数据</h2>
            </div>
            <div className="divide-y divide-border/30">
              <button
                onClick={handleClearData}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-tertiary transition-colors text-left"
              >
                <div className="text-sm text-content-primary">清除本地缓存</div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-content-tertiary">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>
          </div>

          {/* About section */}
          <div className="rounded-2xl border border-border bg-surface-secondary overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50">
              <h2 className="text-xs font-semibold text-content-tertiary uppercase tracking-wide">关于</h2>
            </div>
            <div className="divide-y divide-border/30">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="text-sm text-content-primary">版本</div>
                <div className="text-sm text-content-tertiary">1.0.0</div>
              </div>
              <div className="flex items-center justify-between px-5 py-4">
                <div className="text-sm text-content-primary">产品</div>
                <div className="text-sm text-content-tertiary">ORANGEBENCH</div>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 overflow-hidden">
            <div className="px-5 py-3 border-b border-red-500/20">
              <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wide">危险操作</h2>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-red-500/10 transition-colors text-left"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span className="text-sm text-red-400">退出登录</span>
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-flow-in">
          <div className={`px-4 py-2 rounded-lg text-white text-sm shadow-lg ${toast.ok ? 'bg-green-600/90' : 'bg-red-600/90'}`}>
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

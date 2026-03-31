'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const router = useRouter();

  useEffect(() => {
    const match = document.cookie.match(/ob-user-id=([^;]+)/);
    if (match && match[1]) {
      router.replace('/agent');
    }
  }, [router]);

  function handleLogin() {
    const trimmed = username.trim();
    if (!trimmed) return;
    document.cookie = `ob-user-id=${trimmed}; path=/; max-age=31536000`;
    router.replace('/agent');
  }

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-surface-primary px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-1">
            <span className="text-accent font-semibold text-lg">ORANGE</span>
            <span className="text-content-primary font-semibold text-lg">BENCH</span>
          </div>
          <p className="text-content-tertiary text-sm">输入用户名开始使用</p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="用户名"
            autoFocus
            className="w-full px-4 py-3 rounded-xl border border-border bg-surface-secondary text-content-primary text-sm placeholder:text-content-tertiary focus:outline-none focus:border-accent/50 focus:bg-surface-tertiary transition-all"
          />
          <button
            onClick={handleLogin}
            disabled={!username.trim()}
            className="w-full py-3 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            进入
          </button>
        </div>
      </div>
    </div>
  );
}

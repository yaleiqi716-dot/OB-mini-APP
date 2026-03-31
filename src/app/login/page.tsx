'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const match = document.cookie.match(/ob-user-id=([^;]+)/);
    if (match && match[1]) {
      router.replace('/agent');
    }
  }, [router]);

  function handleLogin() {
    const trimmed = username.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    document.cookie = `ob-user-id=${trimmed}; path=/; max-age=31536000`;
    router.replace('/agent');
  }

  return (
    <div className="login-root">
      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <span className="login-brand-orange">ORANGE</span>
          <span className="login-brand-text">BENCH</span>
        </div>

        <h1 className="login-title">欢迎回来</h1>
        <p className="login-subtitle">输入用户名继续使用</p>

        {/* Form */}
        <div className="login-form">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="用户名"
            autoFocus
            autoComplete="off"
            className="login-input"
          />
          <button
            onClick={handleLogin}
            disabled={!username.trim() || loading}
            className="login-btn"
          >
            {loading ? '跳转中...' : '继续'}
          </button>
        </div>
      </div>
    </div>
  );
}

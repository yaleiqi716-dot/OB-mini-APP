'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/workspace/AppHeader';

export default function NewWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const hasSession = document.cookie.includes('ob-session=') || document.cookie.includes('ob-user-id=');
    if (!hasSession) { router.replace('/login'); }
  }, [router]);

  async function handleCreate() {
    if (!name.trim() || creating) return;
    setCreating(true); setError('');
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        router.push('/workspace');
      } else {
        setError(data.error || '创建失败');
      }
    } catch { setError('网络错误'); }
    finally { setCreating(false); }
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--ob-bg)' }}>
      <AppHeader />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,90,31,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF5A1F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--ob-text)', margin: '0 0 8px' }}>创建工作区</h1>
            <p style={{ fontSize: 14, color: 'var(--ob-text-muted)', margin: 0 }}>为你的团队创建一个协作空间</p>
          </div>

          <div style={{ background: 'var(--ob-surface)', border: '1px solid rgba(245,245,240,0.08)', borderRadius: 16, padding: 24 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--ob-text)', marginBottom: 8 }}>
              工作区名称
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="例如：产品团队、市场部"
              autoFocus
              style={{
                width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(245,245,240,0.08)',
                background: 'var(--ob-surface)', padding: '0 16px', fontSize: 15, color: 'var(--ob-text)', outline: 'none',
                transition: 'border-color .2s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#FF5A1F')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--ob-border)')}
            />

            {error && <p style={{ fontSize: 13, color: '#E4483D', marginTop: 12 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || creating}
                style={{
                  flex: 1, height: 44, borderRadius: 12, fontSize: 15, fontWeight: 600,
                  border: 'none', background: '#FF5A1F', color: '#fff', cursor: 'pointer',
                  opacity: (!name.trim() || creating) ? 0.5 : 1, transition: 'background .2s',
                }}
              >
                {creating ? '创建中...' : '创建工作区'}
              </button>
              <button
                onClick={() => router.back()}
                style={{
                  height: 44, padding: '0 20px', borderRadius: 12, fontSize: 14,
                  border: '1px solid rgba(245,245,240,0.08)', background: 'var(--ob-surface)', color: 'var(--ob-text-muted)', cursor: 'pointer',
                }}
              >
                取消
              </button>
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--ob-text-muted)', textAlign: 'center', marginTop: 16 }}>
            创建后你将成为工作区 Owner，可以邀请成员加入
          </p>
        </div>
      </div>
    </div>
  );
}

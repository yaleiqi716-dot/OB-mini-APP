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
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#121210' }}>
      <AppHeader />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,107,44,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6B2C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: '#F0EDE8', margin: '0 0 8px' }}>创建工作区</h1>
            <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>为你的团队创建一个协作空间</p>
          </div>

          <div style={{ background: '#1A1A17', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#F0EDE8', marginBottom: 8 }}>
              工作区名称
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="例如：产品团队、市场部"
              autoFocus
              style={{
                width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
                background: '#1A1A17', padding: '0 16px', fontSize: 15, color: '#F0EDE8', outline: 'none',
                transition: 'border-color .2s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#FF6B2C')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
            />

            {error && <p style={{ fontSize: 13, color: '#B91C1C', marginTop: 12 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || creating}
                style={{
                  flex: 1, height: 44, borderRadius: 12, fontSize: 15, fontWeight: 600,
                  border: 'none', background: '#FF6B2C', color: '#fff', cursor: 'pointer',
                  opacity: (!name.trim() || creating) ? 0.5 : 1, transition: 'background .2s',
                }}
              >
                {creating ? '创建中...' : '创建工作区'}
              </button>
              <button
                onClick={() => router.back()}
                style={{
                  height: 44, padding: '0 20px', borderRadius: 12, fontSize: 14,
                  border: '1px solid rgba(255,255,255,0.06)', background: '#1A1A17', color: '#6B7280', cursor: 'pointer',
                }}
              >
                取消
              </button>
            </div>
          </div>

          <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 16 }}>
            创建后你将成为工作区 Owner，可以邀请成员加入
          </p>
        </div>
      </div>
    </div>
  );
}

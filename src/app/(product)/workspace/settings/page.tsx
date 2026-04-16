'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader, WorkspaceSubNav } from '@/components/workspace/AppHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  useEffect(() => {
    const hasSession = document.cookie.includes('ob-session=') || document.cookie.includes('ob-user-id=');
    if (!hasSession) { router.replace('/login'); return; }
    fetch('/api/workspace').then(r => r.json()).then(d => {
      if (d?.name) { setName(d.name); setWebhookUrl(d.wecomWebhookUrl || ''); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [router]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), wecomWebhookUrl: webhookUrl.trim() || null }),
      });
      if (res.ok) showToast('已保存');
      else showToast('保存失败');
    } catch { showToast('网络错误'); }
    finally { setSaving(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 40, borderRadius: 12, border: '1px solid rgba(245,245,240,0.08)',
    background: 'var(--ob-surface)', padding: '0 14px', fontSize: 14, color: 'var(--ob-text)', outline: 'none',
  };
  const labelStyle: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: 'var(--ob-text)', marginBottom: 6, display: 'block' };
  const descStyle: React.CSSProperties = { fontSize: 12, color: 'var(--ob-text-muted)', marginTop: 4 };

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--ob-bg)' }}>
      <AppHeader />
      <WorkspaceSubNav />

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 32px 60px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--ob-text)', margin: '0 0 24px' }}>工作区设置</h1>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}><Spinner size="md" /></div>
            </div>
          ) : (
            <div style={{ background: 'var(--ob-surface)', border: '1px solid rgba(245,245,240,0.08)', borderRadius: 16, padding: 24 }}>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>工作区名称</label>
                <input value={name} onChange={e => setName(e.target.value)} style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF5A1F')} onBlur={e => (e.currentTarget.style.borderColor = 'var(--ob-border)')} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>企业微信 Webhook URL</label>
                <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF5A1F')} onBlur={e => (e.currentTarget.style.borderColor = 'var(--ob-border)')} />
                <p style={descStyle}>配置后，任务分配、提交、审核等关键节点会推送通知到企业微信群</p>
              </div>

              <button onClick={handleSave} disabled={!name.trim() || saving}
                style={{ height: 40, padding: '0 24px', borderRadius: 12, fontSize: 14, fontWeight: 600, border: 'none', background: '#FF5A1F', color: '#fff', cursor: 'pointer', opacity: (!name.trim() || saving) ? 0.5 : 1 }}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          )}
        </div>
      </div>

      <Toast value={toast} />
    </div>
  );
}

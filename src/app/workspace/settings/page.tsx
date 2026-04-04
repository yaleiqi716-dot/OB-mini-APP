'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WorkspaceHeader, WorkspaceSubNav } from '@/components/workspace/WorkspaceHeader';

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
    width: '100%', height: 40, borderRadius: 12, border: '1px solid #E7E5E1',
    background: '#FFFFFF', padding: '0 14px', fontSize: 14, color: '#171717', outline: 'none',
  };
  const labelStyle: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: '#171717', marginBottom: 6, display: 'block' };
  const descStyle: React.CSSProperties = { fontSize: 12, color: '#9CA3AF', marginTop: 4 };

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F7F7F4' }}>
      <WorkspaceHeader />
      <WorkspaceSubNav />

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 32px 60px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: '#171717', margin: '0 0 24px' }}>工作区设置</h1>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ width: 20, height: 20, border: '2px solid #F97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' }} />
            </div>
          ) : (
            <div style={{ background: '#FFFFFF', border: '1px solid #E7E5E1', borderRadius: 16, padding: 24 }}>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>工作区名称</label>
                <input value={name} onChange={e => setName(e.target.value)} style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#F97316')} onBlur={e => (e.currentTarget.style.borderColor = '#E7E5E1')} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>企业微信 Webhook URL</label>
                <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#F97316')} onBlur={e => (e.currentTarget.style.borderColor = '#E7E5E1')} />
                <p style={descStyle}>配置后，任务分配、提交、审核等关键节点会推送通知到企业微信群</p>
              </div>

              <button onClick={handleSave} disabled={!name.trim() || saving}
                style={{ height: 40, padding: '0 24px', borderRadius: 12, fontSize: 14, fontWeight: 600, border: 'none', background: '#F97316', color: '#fff', cursor: 'pointer', opacity: (!name.trim() || saving) ? 0.5 : 1 }}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="animate-flow-in" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 60, padding: '10px 20px', borderRadius: 9999, background: 'rgba(34,197,94,0.92)', color: '#fff', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

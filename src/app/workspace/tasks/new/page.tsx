'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';

interface Member { id: string; userId: string; name: string | null; email: string; role: string; }

export default function NewWorkspaceTaskPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(0);
  const [assigneeId, setAssigneeId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const m = document.cookie.match(/ob-user-id=([^;]+)/);
    if (!m || !m[1]) { router.replace('/login'); return; }
    fetch('/api/workspace/members').then(r => r.json()).then(d => { if (Array.isArray(d)) setMembers(d); }).catch(() => {});
  }, [router]);

  async function handleCreate() {
    if (!title.trim() || submitting) return;
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/workspace/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          assigneeId: assigneeId || undefined,
          dueAt: dueAt || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        router.push(`/workspace/tasks/${data.id}`);
      } else {
        setError(data.error || '创建失败');
      }
    } catch { setError('网络错误'); }
    finally { setSubmitting(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 40, borderRadius: 12, border: '1px solid #E7E5E1',
    background: '#FFFFFF', padding: '0 14px', fontSize: 14, color: '#171717', outline: 'none',
    transition: 'border-color .2s',
  };
  const labelStyle: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: '#171717', marginBottom: 6, display: 'block' };

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F7F7F4' }}>
      <WorkspaceHeader />

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 32px 60px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: '#171717', margin: '0 0 24px' }}>新建任务</h1>

          <div style={{ background: '#FFFFFF', border: '1px solid #E7E5E1', borderRadius: 16, padding: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>任务标题 *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：写季度总结报告" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#F97316')} onBlur={e => (e.currentTarget.style.borderColor = '#E7E5E1')} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>任务描述</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="详细描述任务要求..." rows={4}
                style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'vertical', minHeight: 100, fontFamily: 'inherit', lineHeight: 1.6 }}
                onFocus={e => (e.currentTarget.style.borderColor = '#F97316')} onBlur={e => (e.currentTarget.style.borderColor = '#E7E5E1')} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>分配给</label>
                <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">不分配</option>
                  {members.map(m => (
                    <option key={m.userId} value={m.userId}>{m.name || m.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>优先级</label>
                <select value={priority} onChange={e => setPriority(Number(e.target.value))}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value={0}>普通</option>
                  <option value={1}>中</option>
                  <option value={2}>高</option>
                  <option value={3}>紧急</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>截止时间</label>
              <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} style={inputStyle} />
            </div>

            {error && <p style={{ fontSize: 13, color: '#B91C1C', marginBottom: 16 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleCreate} disabled={!title.trim() || submitting}
                style={{ height: 40, padding: '0 24px', borderRadius: 12, fontSize: 14, fontWeight: 600, border: 'none', background: '#F97316', color: '#fff', cursor: 'pointer', opacity: (!title.trim() || submitting) ? 0.5 : 1 }}>
                {submitting ? '创建中...' : '创建任务'}
              </button>
              <button onClick={() => router.back()}
                style={{ height: 40, padding: '0 20px', borderRadius: 12, fontSize: 14, border: '1px solid #E7E5E1', background: '#FFFFFF', color: '#6B7280', cursor: 'pointer' }}>
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/workspace/AppHeader';
import { FileUploader, UploadedFile } from '@/components/workspace/FileUploader';
import { SkillRoleMultiPicker } from '@/components/agent/SkillRoleMultiPicker';

interface Member { id: string; userId: string; name: string | null; email: string; role: string; }

export default function NewWorkspaceTaskPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showDesc, setShowDesc] = useState(false);
  const [priority, setPriority] = useState(0);
  const [assigneeId, setAssigneeId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [preferredSkillRoles, setPreferredSkillRoles] = useState<string[]>([]);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const hasSession = document.cookie.includes('ob-session=') || document.cookie.includes('ob-user-id=');
    if (!hasSession) { router.replace('/login'); return; }
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
          attachments: attachments.length > 0 ? attachments : undefined,
          preferredSkillRoles: preferredSkillRoles.length > 0 ? preferredSkillRoles : undefined,
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

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--ob-bg)' }}>
      <AppHeader />

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px 80px' }}>

          {/* Back link */}
          <a
            href="/workspace"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: 'rgba(245,245,240,0.35)',
              textDecoration: 'none', marginBottom: 20, padding: '4px 0', transition: 'color .15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(245,245,240,0.70)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(245,245,240,0.35)')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            返回工作区
          </a>

          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ob-text)', margin: '0 0 28px' }}>新建任务</h1>

          {/* ── Title input — large, borderless bottom-line only ── */}
          <div style={{ marginBottom: 20 }}>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="输入任务标题..."
              style={{
                width: '100%', fontSize: 16, fontWeight: 500,
                background: 'transparent', border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 0, padding: '10px 0',
                color: 'rgba(245,245,240,0.90)', outline: 'none',
                transition: 'border-color .15s',
              }}
              onFocus={e => (e.currentTarget.style.borderBottomColor = '#FF5A1F')}
              onBlur={e => (e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.12)')}
            />
          </div>

          {/* ── Description — collapsible ── */}
          {!showDesc ? (
            <button
              onClick={() => setShowDesc(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: 'rgba(245,245,240,0.35)',
                padding: '4px 0', marginBottom: 20, display: 'block',
                transition: 'color .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(245,245,240,0.60)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,245,240,0.35)')}
            >
              + 添加描述
            </button>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(245,245,240,0.35)', marginBottom: 6, display: 'block' }}>描述</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="详细描述任务要求..."
                rows={4}
                style={{
                  width: '100%', minHeight: 100, padding: '10px 14px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 8, fontSize: 14, color: 'rgba(245,245,240,0.90)',
                  outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
                  transition: 'border-color .15s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#FF5A1F')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
            </div>
          )}

          {/* ── Assignee + Priority — 2 col grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(245,245,240,0.35)', marginBottom: 6, display: 'block' }}>分配给</label>
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                style={{ width: '100%', height: 40, cursor: 'pointer' }}>
                <option value="">不分配</option>
                {members.map(m => (
                  <option key={m.userId} value={m.userId}>{m.name || m.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(245,245,240,0.35)', marginBottom: 6, display: 'block' }}>优先级</label>
              <select value={priority} onChange={e => setPriority(Number(e.target.value))}
                style={{ width: '100%', height: 40, cursor: 'pointer' }}>
                <option value={0}>普通</option>
                <option value={1}>中</option>
                <option value={2}>高</option>
                <option value={3}>紧急</option>
              </select>
            </div>
          </div>

          {/* ── Due date ── */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(245,245,240,0.35)', marginBottom: 6, display: 'block' }}>截止时间</label>
            <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)}
              style={{ width: '100%', height: 40 }} />
          </div>

          {/* ── AI colleague — collapsible ── */}
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 20 }}>
            <button
              onClick={() => setShowSkillPicker(!showSkillPicker)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '12px 0', color: 'rgba(245,245,240,0.55)', fontSize: 13, transition: 'color .15s',
              }}
            >
              <span>推荐 AI 同事 (可选)</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                style={{ transform: showSkillPicker ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showSkillPicker && (
              <div style={{ paddingBottom: 16 }}>
                <SkillRoleMultiPicker value={preferredSkillRoles} onChange={setPreferredSkillRoles} max={3} />
              </div>
            )}
          </div>

          {/* ── Attachments — collapsible ── */}
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 20 }}>
            <button
              onClick={() => setShowAttachments(!showAttachments)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '12px 0', color: 'rgba(245,245,240,0.55)', fontSize: 13, transition: 'color .15s',
              }}
            >
              <span>附件 (可选)</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                style={{ transform: showAttachments ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showAttachments && (
              <div style={{ paddingBottom: 16 }}>
                <FileUploader files={attachments} onChange={setAttachments} label="" />
              </div>
            )}
          </div>

          {error && <p style={{ fontSize: 13, color: '#FCA5A5', marginBottom: 16 }}>{error}</p>}

          {/* ── Sticky bottom buttons ── */}
          <div style={{
            position: 'sticky', bottom: 0,
            background: 'linear-gradient(to top, #0C0C0A 60%, transparent)',
            padding: '16px 0',
            display: 'flex', justifyContent: 'flex-end', gap: 10,
          }}>
            <button onClick={() => router.back()}
              style={{
                height: 40, padding: '0 20px', borderRadius: 9999, fontSize: 14,
                border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
                color: 'rgba(245,245,240,0.50)', cursor: 'pointer', transition: 'all .15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = 'rgba(245,245,240,0.80)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(245,245,240,0.50)'; }}
            >
              取消
            </button>
            <button onClick={handleCreate} disabled={!title.trim() || submitting}
              style={{
                height: 40, padding: '0 28px', borderRadius: 9999, fontSize: 14, fontWeight: 600,
                border: 'none', background: '#FF5A1F', color: '#fff', cursor: 'pointer',
                opacity: (!title.trim() || submitting) ? 0.5 : 1,
                boxShadow: '0 4px 16px rgba(255,90,31,0.28)',
                transition: 'all .15s ease',
              }}
              onMouseEnter={e => { if (title.trim() && !submitting) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
            >
              {submitting ? '创建中...' : '创建任务'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

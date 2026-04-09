'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/workspace/AppHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';
import { FileUploader, AttachmentList, UploadedFile } from '@/components/workspace/FileUploader';

interface AgentTaskRef { id: string; title: string; status: string; conversationId: string | null; createdAt: string; hasResult: boolean; }
interface LinkRef { id: string; agentTaskId: string; conversationId: string | null; purpose: string; submittedAt: string | null; }
interface WsTaskDetail {
  id: string; title: string; description: string | null; businessStatus: string;
  priority: number; createdBy: string; assigneeId: string | null; dueAt: string | null;
  feedback: string | null; submissionSummary: string | null;
  attachments: UploadedFile[]; submissionAttachments: UploadedFile[];
  createdAt: string; updatedAt: string; userRole: string;
  agentTasks: AgentTaskRef[]; links: LinkRef[];
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', assigned: '已分配', in_progress: '进行中',
  submitted: '已提交', revision: '需修改', completed: '已完成',
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    draft: { bg: 'rgba(156,163,175,0.10)', color: 'var(--ob-text-muted)' },
    assigned: { bg: 'rgba(255,90,31,0.10)', color: 'var(--ob-orange)' },
    in_progress: { bg: 'rgba(255,90,31,0.10)', color: 'var(--ob-orange)' },
    submitted: { bg: 'rgba(154,149,145,0.10)', color: '#9A9591' },
    revision: { bg: 'rgba(228,72,61,0.10)', color: '#E4483D' },
    completed: { bg: 'rgba(201,184,158,0.10)', color: 'var(--ob-success)' },
  };
  const c = colors[status] || colors.draft;
  return <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 12px', fontSize: 12, fontWeight: 500, borderRadius: 9999, background: c.bg, color: c.color }}>{STATUS_LABEL[status] || status}</span>;
}

export default function WorkspaceTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [task, setTask] = useState<WsTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [submitSummary, setSubmitSummary] = useState('');
  const [submitFiles, setSubmitFiles] = useState<UploadedFile[]>([]);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<{ id: string; userId: string; userName: string; content: string; createdAt: string }[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [userId, setUserId] = useState('');

  // Read userId from cookie in useEffect (SSR-safe)
  useEffect(() => {
    const m = document.cookie.match(/ob-user-id=([^;]+)/);
    const hasSession = document.cookie.includes('ob-session=') || (m && m[1]);
    if (!hasSession) { router.replace('/login'); return; }
    if (m?.[1]) setUserId(decodeURIComponent(m[1]));
  }, [router]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  const loadTask = useCallback(() => {
    setLoading(true);
    fetch(`/api/workspace/tasks/${taskId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { if (d?.id) setTask(d); })
      .catch(err => {
        console.error('[loadTask]', err);
        showToast('加载任务失败，请刷新重试');
      })
      .finally(() => setLoading(false));
  }, [taskId]);

  useEffect(() => {
    loadTask();
    // Fetch comments — failures are non-fatal but should still log.
    fetch(`/api/workspace/tasks/${taskId}/comments`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(data => { if (Array.isArray(data)) setComments(data); })
      .catch(err => console.error('[loadComments]', err));
    // Fetch member names for display — failures are non-fatal but should still log.
    fetch('/api/workspace/members')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(data => {
        if (Array.isArray(data)) {
          const names: Record<string, string> = {};
          data.forEach((m: { userId: string; name: string | null; email: string }) => {
            names[m.userId] = m.name || m.email;
          });
          setMemberNames(names);
        }
      })
      .catch(err => console.error('[loadMembers]', err));
  }, [loadTask, taskId]);

  const isOwner = task?.userRole === 'owner';
  const isAssignee = task?.assigneeId === userId;
  const canExecute = isAssignee && ['assigned', 'in_progress', 'revision'].includes(task?.businessStatus || '');
  const canSubmit = isAssignee && ['in_progress', 'revision'].includes(task?.businessStatus || '') && (task?.agentTasks || []).some(t => t.status === 'completed');
  const canReview = isOwner && task?.businessStatus === 'submitted';

  async function handleUseAgent() {
    setActionLoading('agent');
    try {
      const res = await fetch(`/api/workspace/tasks/${taskId}/agent`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.redirectUrl) {
        router.push(data.redirectUrl);
      } else {
        showToast(data.error || '创建 Agent 任务失败');
      }
    } catch { showToast('网络错误'); }
    finally { setActionLoading(null); }
  }

  async function handleSubmit() {
    setActionLoading('submit');
    try {
      const res = await fetch(`/api/workspace/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionSummary: submitSummary.trim() || undefined,
          submissionAttachments: submitFiles.length > 0 ? submitFiles : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) { showToast('已提交，等待审核'); loadTask(); setSubmitSummary(''); setSubmitFiles([]); }
      else showToast(data.error || '提交失败');
    } catch { showToast('网络错误'); }
    finally { setActionLoading(null); }
  }

  async function handleReview(action: 'approve' | 'revision') {
    if (action === 'revision' && !reviewFeedback.trim()) { showToast('请填写修改意见'); return; }
    setActionLoading(action);
    try {
      const res = await fetch(`/api/workspace/tasks/${taskId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, feedback: reviewFeedback.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(action === 'approve' ? '已通过' : '已退回修改');
        loadTask(); setReviewFeedback('');
      } else showToast(data.error || '操作失败');
    } catch { showToast('网络错误'); }
    finally { setActionLoading(null); }
  }

  async function handleSendComment() {
    if (!commentText.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      const res = await fetch(`/api/workspace/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        setComments(prev => [...prev, data]);
        setCommentText('');
      } else showToast(data.error || '发送失败');
    } catch { showToast('网络错误'); }
    finally { setSendingComment(false); }
  }

  const cardStyle: React.CSSProperties = { background: 'var(--ob-surface)', border: '1px solid rgba(245,245,240,0.08)', borderRadius: 16, padding: 20, marginBottom: 16 };
  const actionBtn: React.CSSProperties = { height: 36, padding: '0 18px', borderRadius: 12, fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'background .2s' };

  if (loading || !task) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--ob-bg)' }}>
        <AppHeader />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size="md" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--ob-bg)' }}>
      <AppHeader />

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div className="ob-mission-atmosphere" style={{ maxWidth: 780, margin: '0 auto', padding: '40px 32px 60px' }}>

          {/* Back breadcrumb — deep page escape hatch.
              Previously this detail page had no link back to /workspace,
              leaving users stranded once they clicked through from the
              task board. Added as part of the S6 navigation pass. */}
          <a
            href="/workspace"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontFamily: 'var(--ob-font-mono)',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--ob-text-muted)',
              textDecoration: 'none',
              marginBottom: 20,
              padding: '4px 0',
              transition: 'color .15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ob-orange)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ob-text-muted)')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            返回工作区
          </a>

          {/* Title + meta */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--ob-text)', margin: 0 }}>{task.title}</h1>
              <StatusBadge status={task.businessStatus} />
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--ob-text-muted)' }}>
              {task.assigneeId && <span>负责人：<strong style={{ color: 'var(--ob-text)', fontWeight: 500 }}>{memberNames[task.assigneeId] || task.assigneeId}</strong></span>}
              <span>创建于 {new Date(task.createdAt).toLocaleDateString('zh-CN')}</span>
              {task.dueAt && <span>截止 {new Date(task.dueAt).toLocaleDateString('zh-CN')}</span>}
              {task.priority >= 2 && <span style={{ color: '#E4483D', fontWeight: 500 }}>紧急</span>}
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div style={cardStyle}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ob-text-muted)', margin: '0 0 8px' }}>任务描述</p>
              <p style={{ fontSize: 14, color: '#8A8A90', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>{task.description}</p>
            </div>
          )}

          {/* Task attachments */}
          {task.attachments && task.attachments.length > 0 && (
            <div style={cardStyle}>
              <AttachmentList files={task.attachments} title="参考资料" />
            </div>
          )}

          {/* Revision feedback */}
          {task.feedback && task.businessStatus === 'revision' && (
            <div style={{ ...cardStyle, background: '#FFF7F5', borderColor: '#F5D0C5' }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ob-orange)', margin: '0 0 8px' }}>修改意见</p>
              <p style={{ fontSize: 14, color: '#8A8A90', lineHeight: 1.6, margin: 0 }}>{task.feedback}</p>
            </div>
          )}

          {/* Agent execution history */}
          {task.agentTasks.length > 0 && (
            <div style={cardStyle}>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ob-text)', margin: '0 0 12px' }}>执行记录</p>
              {task.agentTasks.map((at, i) => {
                const link = task.links.find(l => l.agentTaskId === at.id);
                return (
                  <div key={at.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < task.agentTasks.length - 1 ? '1px solid rgba(245,245,240,0.08)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: at.status === 'completed' ? '#C9B89E' : at.status === 'failed' ? '#E4483D' : '#FF5A1F', flexShrink: 0 }} />
                      <span style={{ fontSize: 14, color: 'var(--ob-text)' }}>{at.title || 'Agent 任务'}</span>
                      {link?.purpose === 'final' && <span style={{ fontSize: 11, color: 'var(--ob-success)', fontWeight: 500 }}>已提交</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--ob-text-muted)' }}>{new Date(at.createdAt).toLocaleDateString('zh-CN')}</span>
                      {at.conversationId && (
                        <a href={`/agent?conversationId=${at.conversationId}`} style={{ height: 26, padding: '0 10px', borderRadius: 9999, fontSize: 12, fontWeight: 500, border: '1px solid rgba(245,245,240,0.08)', background: 'var(--ob-surface)', color: 'var(--ob-text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>查看</a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Submission summary + attachments */}
          {task.businessStatus === 'submitted' && (task.submissionSummary || (task.submissionAttachments && task.submissionAttachments.length > 0)) && (
            <div style={cardStyle}>
              {task.submissionSummary && (
                <>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ob-text-muted)', margin: '0 0 8px' }}>交付说明</p>
                  <p style={{ fontSize: 14, color: '#8A8A90', lineHeight: 1.6, margin: '0 0 12px' }}>{task.submissionSummary}</p>
                </>
              )}
              {task.submissionAttachments && task.submissionAttachments.length > 0 && (
                <AttachmentList files={task.submissionAttachments} title="交付附件" />
              )}
            </div>
          )}

          {/* ── Comments / Discussion ── */}
          <div style={cardStyle}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ob-text)', margin: '0 0 12px' }}>讨论</p>

            {comments.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ob-text-muted)', marginBottom: 12 }}>暂无讨论，发条消息开始</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {comments.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(255,90,31,0.10)', color: '#FF5A1F',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 600, marginTop: 2,
                    }}>
                      {(c.userName || 'U').slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ob-text)' }}>{c.userName}</span>
                        <span style={{ fontSize: 11, color: 'var(--ob-text-muted)' }}>
                          {new Date(c.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ fontSize: 14, color: '#8A8A90', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comment input */}
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                placeholder="输入讨论内容..."
                rows={2}
                style={{
                  flex: 1, borderRadius: 12, border: '1px solid rgba(245,245,240,0.08)',
                  padding: '10px 14px', fontSize: 14, color: 'var(--ob-text)',
                  outline: 'none', resize: 'none', minHeight: 44, fontFamily: 'inherit',
                  transition: 'border-color .2s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#FF5A1F')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--ob-border)')}
              />
              <button
                onClick={handleSendComment}
                disabled={!commentText.trim() || sendingComment}
                style={{
                  height: 44, padding: '0 16px', borderRadius: 12,
                  fontSize: 14, fontWeight: 500, border: 'none',
                  background: (!commentText.trim() || sendingComment) ? '#D5D3CE' : '#FF5A1F',
                  color: '#fff', cursor: (!commentText.trim() || sendingComment) ? 'not-allowed' : 'pointer',
                  flexShrink: 0, transition: 'background .2s',
                }}
              >
                {sendingComment ? '...' : '发送'}
              </button>
            </div>
          </div>

          {/* ── Action area ── */}
          <div style={cardStyle}>

            {/* Member: Use Agent */}
            {canExecute && (
              <div style={{ marginBottom: 16 }}>
                <button onClick={handleUseAgent} disabled={actionLoading === 'agent'}
                  style={{ ...actionBtn, background: '#FF5A1F', color: '#fff', opacity: actionLoading === 'agent' ? 0.5 : 1 }}>
                  {actionLoading === 'agent' ? '创建中...' : '用 Agent 执行'}
                </button>
              </div>
            )}

            {/* Member: Submit */}
            {canSubmit && (
              <div style={{ borderTop: canExecute ? '1px solid rgba(245,245,240,0.08)' : 'none', paddingTop: canExecute ? 16 : 0 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ob-text)', margin: '0 0 8px' }}>提交交付物</p>
                <textarea value={submitSummary} onChange={e => setSubmitSummary(e.target.value)}
                  placeholder="简要说明你的交付内容（可选）" rows={2}
                  style={{ width: '100%', borderRadius: 12, border: '1px solid rgba(245,245,240,0.08)', padding: '10px 14px', fontSize: 14, color: 'var(--ob-text)', outline: 'none', resize: 'vertical', minHeight: 60, fontFamily: 'inherit', marginBottom: 10 }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF5A1F')} onBlur={e => (e.currentTarget.style.borderColor = 'var(--ob-border)')} />
                <div style={{ marginBottom: 12 }}>
                  <FileUploader files={submitFiles} onChange={setSubmitFiles} label="附加文件（可选）" />
                </div>
                <button onClick={handleSubmit} disabled={actionLoading === 'submit'}
                  style={{ ...actionBtn, background: '#171717', color: '#fff', opacity: actionLoading === 'submit' ? 0.5 : 1 }}>
                  {actionLoading === 'submit' ? '提交中...' : '提交交付物'}
                </button>
              </div>
            )}

            {/* Owner: Review */}
            {canReview && (
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ob-text)', margin: '0 0 12px' }}>审核</p>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  <button onClick={() => handleReview('approve')} disabled={!!actionLoading}
                    style={{ ...actionBtn, background: 'var(--ob-success)', color: '#fff', opacity: actionLoading ? 0.5 : 1 }}>
                    {actionLoading === 'approve' ? '处理中...' : '通过'}
                  </button>
                </div>
                <div>
                  <textarea value={reviewFeedback} onChange={e => setReviewFeedback(e.target.value)}
                    placeholder="填写修改意见后点击退回..." rows={2}
                    style={{ width: '100%', borderRadius: 12, border: '1px solid rgba(245,245,240,0.08)', padding: '10px 14px', fontSize: 14, color: 'var(--ob-text)', outline: 'none', resize: 'vertical', minHeight: 60, fontFamily: 'inherit', marginBottom: 10 }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#FF5A1F')} onBlur={e => (e.currentTarget.style.borderColor = 'var(--ob-border)')} />
                  <button onClick={() => handleReview('revision')} disabled={!!actionLoading || !reviewFeedback.trim()}
                    style={{ ...actionBtn, background: 'var(--ob-surface)', border: '1px solid rgba(185,28,28,0.18)', color: '#E4483D', opacity: (actionLoading || !reviewFeedback.trim()) ? 0.5 : 1 }}>
                    {actionLoading === 'revision' ? '处理中...' : '退回修改'}
                  </button>
                </div>
              </div>
            )}

            {/* Completed */}
            {task.businessStatus === 'completed' && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <span style={{ fontSize: 14, color: 'var(--ob-success)', fontWeight: 500 }}>任务已完成</span>
              </div>
            )}

            {/* No actions available */}
            {!canExecute && !canSubmit && !canReview && task.businessStatus !== 'completed' && task.businessStatus !== 'submitted' && (
              <p style={{ fontSize: 14, color: 'var(--ob-text-muted)', textAlign: 'center' }}>等待任务负责人处理</p>
            )}

            {/* Submitted waiting for owner */}
            {task.businessStatus === 'submitted' && !canReview && (
              <p style={{ fontSize: 14, color: '#9A9591', textAlign: 'center' }}>已提交，等待审核</p>
            )}
          </div>
        </div>
      </div>

      <Toast value={toast} />
    </div>
  );
}

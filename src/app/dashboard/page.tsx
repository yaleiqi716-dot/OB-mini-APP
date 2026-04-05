'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { AppHeader } from '@/components/workspace/AppHeader';

interface TaskRef {
  id: string;
  title: string;
  type: string;
  status?: string;
  priority?: number;
  updatedAt?: string;
  createdAt?: string;
  conversationId?: string;
}

interface Summary {
  total: number;
  running: number;
  completed: number;
  failed: number;
  pausedAutoTasks: number;
  highlights: string[];
  risks: string[];
  aiSuggestions: string[];
  waitingReviewTasks?: TaskRef[];
  highPriorityTasks?: TaskRef[];
  recentTasks?: TaskRef[];
  failedTasks?: (TaskRef & { errorMessage?: string | null })[];
}

const STATUS_LABEL: Record<string, string> = {
  queued: '排队中', running: '执行中', executing: '执行中',
  interacting: '等待确认', completed: '已完成', failed: '失败',
  understanding: '理解中', structuring: '规划中',
};

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days} 天前` : new Date(dateStr).toLocaleDateString('zh-CN');
}

function StatusBadge({ status }: { status: string }) {
  const isRunning = ['queued', 'understanding', 'running', 'executing', 'interacting', 'structuring'].includes(status);
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  let bg = 'rgba(156,163,175,0.10)'; let color = '#6B7280';
  if (isRunning)   { bg = 'rgba(255,107,44,0.10)'; color = '#C2410C'; }
  if (isCompleted) { bg = 'rgba(16,185,129,0.10)'; color = '#047857'; }
  if (isFailed)    { bg = 'rgba(239,68,68,0.10)';  color = '#B91C1C'; }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', fontSize: 11, fontWeight: 500, borderRadius: 9999, background: bg, color, whiteSpace: 'nowrap' }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

type TimeRange = 'today' | 'week' | 'month';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [wsSummary, setWsSummary] = useState<{ name: string; assigned: number; submitted: number; completed: number } | null>(null);

  useEffect(() => {
    const m = document.cookie.match(/ob-user-id=([^;]+)/);
    if (!m || !m[1]) { router.replace('/login'); }
  }, [router]);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadData = useCallback(() => {
    fetch('/api/summary')
      .then((r) => { if (!r.ok) throw new Error('加载失败'); return r.json(); })
      .then(setData)
      .catch(() => setError('数据加载失败，请刷新重试'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Fetch workspace summary
  useEffect(() => {
    Promise.all([
      fetch('/api/workspace').then(r => r.json()),
      fetch('/api/workspace/tasks').then(r => r.json()),
    ]).then(([ws, tasks]) => {
      if (ws?.id && Array.isArray(tasks)) {
        setWsSummary({
          name: ws.name,
          assigned: tasks.filter((t: { businessStatus: string }) => ['assigned', 'in_progress'].includes(t.businessStatus)).length,
          submitted: tasks.filter((t: { businessStatus: string }) => ['submitted', 'revision'].includes(t.businessStatus)).length,
          completed: tasks.filter((t: { businessStatus: string }) => t.businessStatus === 'completed').length,
        });
      }
    }).catch(() => {});
  }, []);

  async function handleRetry(taskId: string) {
    if (actionLoading) return;
    setActionLoading(taskId);
    try {
      const r = await fetch(`/api/tasks/${taskId}/retry`, { method: 'POST' });
      if (r.ok) { showToast('已重新提交执行', true); loadData(); }
      else showToast('重试失败', false);
    } catch { showToast('网络错误', false); }
    finally { setActionLoading(null); }
  }

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#121210' }}>
        <AppHeader />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size="md" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#121210' }}>
        <AppHeader />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <p style={{ fontSize: 14, color: '#6B7280' }}>{error || '数据加载失败'}</p>
          <button onClick={() => window.location.reload()} style={{ fontSize: 13, color: '#FF6B2C', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>刷新页面</button>
        </div>
      </div>
    );
  }

  const recentTasks = (data.recentTasks ?? []).slice(0, 5);
  const needAttention = [
    ...(data.failedTasks ?? []).map(t => ({ ...t, reason: 'failed' as const })),
    ...(data.recentTasks ?? []).filter(t => ['running', 'executing', 'queued'].includes(t.status || '')).slice(0, 3).map(t => ({ ...t, reason: 'running' as const, errorMessage: undefined as string | null | undefined })),
  ];

  const statCards: { label: string; value: number; accent?: string }[] = [
    { label: '总任务数', value: data.total },
    { label: '进行中', value: data.running, accent: '#C2410C' },
    { label: '已完成', value: data.completed, accent: '#047857' },
    { label: '失败', value: data.failed, accent: '#B91C1C' },
  ];

  const timeChips: { value: TimeRange; label: string }[] = [
    { value: 'today', label: '今天' },
    { value: 'week', label: '近7天' },
    { value: 'month', label: '本月' },
  ];

  const aiText = data.aiSuggestions.length > 0
    ? data.aiSuggestions.join('\n\n')
    : null;

  const actionBtnStyle: React.CSSProperties = {
    height: 30, padding: '0 12px', borderRadius: 9999,
    fontSize: 12, fontWeight: 500,
    border: '1px solid rgba(255,255,255,0.06)', background: '#1A1A17',
    color: '#6B7280', textDecoration: 'none', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center',
    transition: 'border-color .2s, background .2s, color .2s',
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#121210' }}>
      <AppHeader />

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 60px' }}>

          {/* ── Top area ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 600, color: '#F0EDE8', lineHeight: 1.2, margin: 0 }}>总览</h1>
            </div>
            {/* Time range chips */}
            <div style={{ display: 'flex', gap: 6 }}>
              {timeChips.map(c => (
                <button
                  key={c.value}
                  onClick={() => setTimeRange(c.value)}
                  style={{
                    height: 32, padding: '0 14px', borderRadius: 9999,
                    fontSize: 13, fontWeight: timeRange === c.value ? 500 : 400,
                    border: timeRange === c.value ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    background: timeRange === c.value ? 'rgba(255,107,44,0.10)' : '#1A1A17',
                    color: timeRange === c.value ? '#FF6B2C' : '#6B7280',
                    cursor: 'pointer', transition: 'all .2s',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <p style={{ fontSize: 14, color: '#9CA3AF', margin: '0 0 24px' }}>查看当前任务进展与 AI 工作概览</p>

          {/* ── Row 1: 4 stat cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            {statCards.map(s => (
              <div key={s.label} style={{
                background: '#1A1A17', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16,
                padding: 18, height: 108,
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}>
                <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 6px' }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 650, color: s.accent || '#F0EDE8', margin: 0, lineHeight: 1 }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* ── Workspace summary card ── */}
          {wsSummary && (
            <div style={{
              background: '#1A1A17', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16,
              padding: 18, marginBottom: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#F0EDE8', margin: '0 0 4px' }}>
                    工作区：{wsSummary.name}
                  </p>
                  <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>团队任务概览</p>
                </div>
                <div style={{ display: 'flex', gap: 16, marginLeft: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 20, fontWeight: 650, color: '#C2410C', margin: 0 }}>{wsSummary.assigned}</p>
                    <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>进行中</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 20, fontWeight: 650, color: '#1D4ED8', margin: 0 }}>{wsSummary.submitted}</p>
                    <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>待审核</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 20, fontWeight: 650, color: '#047857', margin: 0 }}>{wsSummary.completed}</p>
                    <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>已完成</p>
                  </div>
                </div>
              </div>
              <a href="/workspace" style={{
                height: 30, padding: '0 14px', borderRadius: 9999, fontSize: 13, fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.06)', background: '#1A1A17', color: '#6B7280',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                transition: 'border-color .2s, color .2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,107,44,0.3)'; e.currentTarget.style.color = '#FF6B2C'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#6B7280'; }}
              >查看工作区</a>
            </div>
          )}

          {/* ── Row 2: Recent tasks + AI Summary ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 20, marginBottom: 20 }}>

            {/* Left: Recent tasks */}
            <div style={{ background: '#1A1A17', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 18 }}>
              <p style={{ fontSize: 17, fontWeight: 600, color: '#F0EDE8', margin: '0 0 14px' }}>最近任务</p>
              {recentTasks.length > 0 ? (
                <div>
                  {recentTasks.map((t, i) => (
                    <a
                      key={t.id}
                      href={t.conversationId ? `/agent?conversationId=${t.conversationId}` : `/tasks/${t.id}`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        height: 56, padding: '0 4px', textDecoration: 'none',
                        borderBottom: i < recentTasks.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        transition: 'background .2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.015)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#F0EDE8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title || '未命名任务'}
                        </span>
                        <span style={{ fontSize: 12, color: '#6B7280' }}>{timeAgo(t.updatedAt || t.createdAt)}</span>
                      </div>
                      {t.status && <StatusBadge status={t.status} />}
                    </a>
                  ))}
                  <a href="/tasks" style={{ display: 'block', textAlign: 'center', fontSize: 13, color: '#FF6B2C', textDecoration: 'none', marginTop: 12, transition: 'opacity .2s' }}>
                    查看全部任务
                  </a>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', padding: '24px 0' }}>暂无任务记录</p>
              )}
            </div>

            {/* Right: AI Summary */}
            <div style={{ background: '#1A1A17', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, minHeight: 260 }}>
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 17, fontWeight: 600, color: '#F0EDE8', margin: 0 }}>AI 总结</p>
                <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>基于你的任务数据自动生成</p>
              </div>
              {aiText ? (
                <p style={{ fontSize: 14, color: '#D1D5DB', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>{aiText}</p>
              ) : (
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.75, margin: 0 }}>
                  等任务多一点后，ORANGEBENCH 会在这里帮你总结趋势和重点。
                </p>
              )}
            </div>
          </div>

          {/* ── Row 3: Needs attention ── */}
          <div style={{ background: '#1A1A17', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 18 }}>
            <p style={{ fontSize: 17, fontWeight: 600, color: '#F0EDE8', margin: '0 0 14px' }}>需要关注</p>
            {needAttention.length > 0 ? (
              <div>
                {needAttention.map((t, i) => (
                  <div
                    key={t.id + t.reason}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 4px',
                      borderBottom: i < needAttention.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#F0EDE8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title || '未命名任务'}
                        </span>
                        {t.status && <StatusBadge status={t.status} />}
                      </div>
                      <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 0' }}>
                        {t.reason === 'failed' ? '当前能力暂不可用 · 请稍后重试' : `${timeAgo(t.updatedAt || t.createdAt)} 开始执行`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {t.reason === 'failed' && (
                        <button
                          onClick={() => handleRetry(t.id)}
                          disabled={actionLoading === t.id}
                          aria-label="重试"
                          style={{ ...actionBtnStyle, color: '#B91C1C', opacity: actionLoading === t.id ? 0.5 : 1 }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,107,44,0.3)'; e.currentTarget.style.background = 'rgba(255,107,44,0.06)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = '#FFFFFF'; }}
                        >
                          {actionLoading === t.id ? '重试中...' : '重试'}
                        </button>
                      )}
                      <a
                        href={t.conversationId ? `/agent?conversationId=${t.conversationId}` : `/tasks/${t.id}`}
                        style={actionBtnStyle}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,107,44,0.3)'; e.currentTarget.style.background = 'rgba(255,107,44,0.06)'; e.currentTarget.style.color = '#FF6B2C'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.color = '#6B7280'; }}
                      >
                        查看
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', padding: '16px 0' }}>目前没有需要关注的任务</p>
            )}
          </div>

        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="animate-flow-in" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 60, padding: '10px 20px', borderRadius: 9999,
          background: toast.ok ? 'rgba(34,197,94,0.92)' : 'rgba(239,68,68,0.92)',
          color: '#fff', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

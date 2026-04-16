'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { AppHeader } from '@/components/workspace/AppHeader';

interface TaskItem {
  id: string;
  title: string;
  type?: string;
  status: string;
  input?: string;
  priority?: number;
  createdAt: string;
  updatedAt?: string;
  conversationId?: string;
}

const STATUS_LABEL: Record<string, string> = {
  queued: '排队中', understanding: '理解中', running: '执行中',
  executing: '执行中', interacting: '等待确认', structuring: '规划中',
  completed: '已完成', failed: '失败', cancelled: '已取消',
  // Workspace business statuses
  draft: '草稿', assigned: '已分配', in_progress: '进行中',
  submitted: '已提交', revision: '需修改',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

type FilterType = 'all' | 'running' | 'review' | 'completed' | 'failed';

// "待审核" (review) is the consolidation of the old /review top-level page.
// /review's data source is the same /api/tasks/mine + /api/workspace/tasks,
// just filtered by status. Pulling it in as a tab here means there's one
// place to find your work — not three confusingly similar destinations.
const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'running', label: '进行中' },
  { value: 'review', label: '待审核' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
];

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const isRunning = ['queued', 'understanding', 'running', 'executing', 'interacting', 'structuring', 'assigned', 'in_progress'].includes(status);
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isReview = ['submitted', 'revision'].includes(status);

  let bg = 'rgba(156,163,175,0.08)';
  let color = 'var(--ob-text-muted)';
  let border = '1px solid rgba(156,163,175,0.15)';
  if (isRunning)   { bg = 'rgba(255,90,31,0.12)'; color = '#FF8C5A'; border = '1px solid rgba(255,90,31,0.20)'; }
  if (isCompleted) { bg = 'rgba(22,163,74,0.12)'; color = '#6EE7A0'; border = '1px solid rgba(22,163,74,0.20)'; }
  if (isFailed)    { bg = 'rgba(220,38,38,0.12)'; color = '#F87171'; border = '1px solid rgba(220,38,38,0.20)'; }
  if (isReview)    { bg = 'rgba(234,179,8,0.12)'; color = '#FCD34D'; border = '1px solid rgba(234,179,8,0.20)'; }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      height: 22, padding: '0 8px',
      fontSize: 11, fontWeight: 500,
      borderRadius: 6,
      background: bg, color, border,
      whiteSpace: 'nowrap',
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function MyTasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Initial filter can be set via ?filter=review — used by the legacy
  // /review → /tasks?filter=review redirect in src/app/review/page.tsx
  // so bookmarks keep working.
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [wsTasks, setWsTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>(
    FILTER_OPTIONS.some(o => o.value === initialFilter) ? initialFilter : 'all',
  );
  const [retrying, setRetrying] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'personal' | 'team'>('personal');
  const [hasWorkspace, setHasWorkspace] = useState(false);

  useEffect(() => {
    const m = document.cookie.match(/ob-user-id=([^;]+)/);
    if (!m || !m[1]) { router.replace('/login'); }
  }, [router]);

  async function handleRetry(taskId: string) {
    setRetrying(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'queued' }),
      });
      if (!res.ok) throw new Error('重试失败');
      fetchTasks();
    } catch {
      alert('重试失败，请稍后再试');
    } finally {
      setRetrying(null);
    }
  }

  const fetchTasks = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/tasks/mine')
      .then((r) => { if (!r.ok) throw new Error('加载失败'); return r.json(); })
      .then((data) => {
        if (Array.isArray(data)) setTasks(data);
        else if (Array.isArray(data.tasks)) setTasks(data.tasks);
        else setError('数据格式异常');
      })
      .catch(() => setError('网络错误，请刷新重试'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Fetch workspace tasks (team view)
  useEffect(() => {
    fetch('/api/workspace').then(r => r.json()).then(d => {
      if (d?.id) {
        setHasWorkspace(true);
        fetch('/api/workspace/tasks').then(r => r.json()).then(wt => {
          if (Array.isArray(wt)) {
            setWsTasks(wt.map((t: Record<string, unknown>) => ({
              id: t.id as string,
              title: t.title as string,
              status: (t.businessStatus as string) || 'draft',
              input: t.description as string || '',
              createdAt: t.createdAt as string,
              updatedAt: t.updatedAt as string,
            })));
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Running = actively being worked on, NOT waiting on user review.
  // Note: 'interacting' (AI is waiting for user response) is review state,
  // not running state — it was previously misclassified here.
  const isRunning = (s: string) => ['queued', 'understanding', 'running', 'executing', 'structuring'].includes(s);
  // Review = awaiting human decision. For personal AI tasks, that's
  // 'interacting' (AI asked a follow-up). For team workspace tasks,
  // that's 'submitted' (assignee turned it in) or 'revision' (owner
  // asked for changes).
  const isReview = (s: string, isTeam: boolean) =>
    isTeam ? ['submitted', 'revision'].includes(s) : s === 'interacting';

  const activeTasks = viewMode === 'team' ? wsTasks : tasks;
  const filtered = activeTasks.filter((t) => {
    const isTeam = viewMode === 'team';
    if (isTeam) {
      // Team mode uses workspace business statuses
      if (filter === 'running' && !['assigned', 'in_progress'].includes(t.status)) return false;
      if (filter === 'review' && !isReview(t.status, true)) return false;
      if (filter === 'completed' && t.status !== 'completed') return false;
      // Workspace tasks don't have a 'failed' business state — hide
      // everything when 'failed' is selected in team mode (the filter
      // still exists for consistency; personal view is the user of it).
      if (filter === 'failed') return false;
    } else {
      if (filter === 'running' && !isRunning(t.status)) return false;
      if (filter === 'review' && !isReview(t.status, false)) return false;
      if (filter === 'completed' && t.status !== 'completed') return false;
      if (filter === 'failed' && t.status !== 'failed') return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(t.title || '').toLowerCase().includes(q) && !(t.input || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--ob-bg)' }}>
      <AppHeader />

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '0 0 60px' }}>

          {/* ── Compact header — Monday style ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'rgba(245,245,240,0.92)', margin: 0 }}>我的任务</h1>
            </div>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(245,245,240,0.28)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input placeholder="搜索任务..." value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, height: 32, paddingLeft: 30, paddingRight: 12, fontSize: 13, color: 'rgba(245,245,240,0.80)', width: 200, outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(255,90,31,0.40)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
            </div>
          </div>

          {/* ── View mode tabs ── */}
          {hasWorkspace && (
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid rgba(245,245,240,0.08)' }}>
              {([['personal', '个人'], ['team', '团队']] as const).map(([value, label]) => (
                <button key={value} onClick={() => { setViewMode(value); setFilter('all'); }}
                  style={{
                    padding: '8px 20px', fontSize: 14, fontWeight: viewMode === value ? 600 : 400,
                    color: viewMode === value ? '#FF5A1F' : 'var(--ob-text-muted)',
                    borderBottom: viewMode === value ? '2px solid #FF5A1F' : '2px solid transparent',
                    background: 'transparent', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                    cursor: 'pointer', transition: 'color .2s',
                    marginBottom: -1,
                  }}
                >{label}</button>
              ))}
            </div>
          )}

          {/* ── Filter chips ── */}
          <div style={{ display: 'flex', gap: 6, padding: '10px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {FILTER_OPTIONS.map((opt) => {
              const active = filter === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  style={{
                    height: 30, padding: '0 14px',
                    borderRadius: 9999, fontSize: 12, fontWeight: 500,
                    border: active ? '1px solid rgba(255,90,31,0.35)' : '1px solid rgba(255,255,255,0.08)',
                    background: active ? 'rgba(255,90,31,0.12)' : 'rgba(255,255,255,0.04)',
                    color: active ? '#FF5A1F' : 'rgba(245,245,240,0.55)',
                    cursor: 'pointer',
                    transition: 'all .15s ease',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* ── Content ── */}
          {loading ? (
            /* Skeleton shimmer rows */
            <div>
              {Array.from({length: 6}).map((_, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: 'minmax(200px,1fr) 80px 100px 120px',
                  alignItems: 'center', padding: '0 20px', height: 46,
                  borderBottom: '1px solid rgba(255,255,255,0.04)', gap: 16,
                }}>
                  <div className="ob-skeleton" style={{ height: 14, width: `${50 + i * 8}%` }} />
                  <div className="ob-skeleton" style={{ height: 12, width: 50 }} />
                  <div className="ob-skeleton" style={{ height: 12, width: 60 }} />
                  <div />
                </div>
              ))}
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(228,72,61,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E4483D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <p style={{ fontSize: 14, color: 'var(--ob-text-muted)', marginBottom: 12 }}>{error}</p>
              <button onClick={fetchTasks} style={{ fontSize: 13, color: '#FF5A1F', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>重新加载</button>
            </div>
          ) : filtered.length === 0 ? (
            /* ── Empty state ── */
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'var(--ob-surface)', border: '1px solid rgba(245,245,240,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CCCCCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="16" x2="12" y2="16"/>
                </svg>
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--ob-text)', marginBottom: 6 }}>还没有任务记录</p>
              <p style={{ fontSize: 14, color: 'var(--ob-text-muted)', marginBottom: 20 }}>去 Agent 交给 ORANGEBENCH 一个任务吧</p>
              <a
                href="/agent"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  height: 36, padding: '0 18px',
                  borderRadius: 9999, fontSize: 14, fontWeight: 500,
                  background: '#FF5A1F', color: '#fff',
                  textDecoration: 'none',
                  transition: 'background .2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#E63600')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#FF5A1F')}
              >
                去 Agent
              </a>
            </div>
          ) : (
            /* ── Task row list — Monday-style compact rows ── */
            <div>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'minmax(200px,1fr) 80px 100px 120px',
                padding: '6px 20px', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase',
                color: 'rgba(245,245,240,0.22)', borderBottom: '1px solid rgba(255,255,255,0.06)',
                fontFamily: 'var(--ob-font-mono)',
              }}>
                <span>任务</span><span>时间</span><span>状态</span><span style={{ textAlign: 'right' }}>操作</span>
              </div>

              {filtered.map((t) => {
                const isTeam = viewMode === 'team';
                const failed = isTeam ? false : t.status === 'failed';
                const displayTitle = t.title || t.input?.slice(0, 60) || '未命名任务';
                const detailUrl = isTeam ? `/workspace/tasks/${t.id}` : `/tasks/${t.id}`;
                const openUrl = t.conversationId ? `/agent?conversationId=${t.conversationId}` : detailUrl;

                return (
                  <div
                    key={t.id}
                    style={{
                      display: 'grid', gridTemplateColumns: 'minmax(200px,1fr) 80px 100px 120px',
                      alignItems: 'center', padding: '0 20px', height: 46,
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      borderLeft: failed ? '3px solid rgba(248,113,113,0.45)' : '3px solid transparent',
                      cursor: 'pointer', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => window.location.href = openUrl}
                  >
                    {/* Title */}
                    <span style={{
                      fontSize: 14, fontWeight: 500, color: 'rgba(245,245,240,0.88)',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingRight: 16,
                    }}>
                      {displayTitle}
                    </span>

                    {/* Time */}
                    <span style={{ fontSize: 12, color: 'rgba(245,245,240,0.32)' }}>
                      {timeAgo(t.updatedAt || t.createdAt)}
                    </span>

                    {/* Status */}
                    <StatusBadge status={t.status} />

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                      {failed && (
                        <button
                          onClick={() => handleRetry(t.id)}
                          disabled={retrying === t.id}
                          style={{
                            fontSize: 12, color: 'rgba(245,245,240,0.45)',
                            border: '1px solid rgba(255,255,255,0.10)', borderRadius: 99,
                            padding: '3px 12px', background: 'transparent', cursor: 'pointer',
                            opacity: retrying === t.id ? 0.5 : 1, transition: 'all .12s',
                          }}
                        >重试</button>
                      )}
                      <a
                        href={openUrl}
                        style={{
                          fontSize: 12, color: 'rgba(245,245,240,0.70)',
                          border: '1px solid rgba(255,255,255,0.14)', borderRadius: 99,
                          padding: '3px 12px', background: 'transparent', textDecoration: 'none',
                          transition: 'all .12s',
                        }}
                      >打开</a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

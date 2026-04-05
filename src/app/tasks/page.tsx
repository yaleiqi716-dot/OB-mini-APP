'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

type FilterType = 'all' | 'running' | 'completed' | 'failed';

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'running', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
];

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const isRunning = ['queued', 'understanding', 'running', 'executing', 'interacting', 'structuring', 'assigned', 'in_progress'].includes(status);
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isReview = ['submitted', 'revision'].includes(status);

  let bg = 'rgba(156,163,175,0.10)';
  let color = '#6B7280';
  if (isRunning)   { bg = 'rgba(255,107,44,0.10)'; color = '#C2410C'; }
  if (isCompleted) { bg = 'rgba(16,185,129,0.10)'; color = '#047857'; }
  if (isFailed)    { bg = 'rgba(239,68,68,0.10)';  color = '#B91C1C'; }
  if (isReview)    { bg = 'rgba(59,130,246,0.10)';  color = '#1D4ED8'; }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      height: 22, padding: '0 10px',
      fontSize: 11, fontWeight: 500,
      borderRadius: 9999,
      background: bg, color,
      whiteSpace: 'nowrap',
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function MyTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [wsTasks, setWsTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
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

  const isRunning = (s: string) => ['queued', 'understanding', 'running', 'executing', 'interacting', 'structuring'].includes(s);

  const activeTasks = viewMode === 'team' ? wsTasks : tasks;
  const filtered = activeTasks.filter((t) => {
    if (viewMode === 'team') {
      // Team mode uses workspace business statuses
      if (filter === 'running' && !['assigned', 'in_progress', 'revision'].includes(t.status)) return false;
      if (filter === 'completed' && t.status !== 'completed') return false;
      if (filter === 'failed' && t.status !== 'submitted') return false; // "submitted" maps to "pending review"
    } else {
      if (filter === 'running' && !isRunning(t.status)) return false;
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
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#121210' }}>
      <AppHeader />

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 32px 60px' }}>

          {/* ── Top area: title + search ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 600, color: '#F0EDE8', lineHeight: 1.2, margin: 0 }}>任务</h1>
            </div>
            {/* Search box */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input
                type="text"
                placeholder="搜索任务..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: 220, height: 36, borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.06)', background: '#1A1A17',
                  padding: '0 12px 0 34px', fontSize: 13,
                  color: '#F0EDE8', outline: 'none',
                  transition: 'border-color .2s, box-shadow .2s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#FF6B2C'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,107,44,0.12)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          <p style={{ fontSize: 14, color: '#9CA3AF', margin: '0 0 16px' }}>查看你的 AI 执行记录与结果</p>

          {/* ── View mode tabs ── */}
          {hasWorkspace && (
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {([['personal', '个人'], ['team', '团队']] as const).map(([value, label]) => (
                <button key={value} onClick={() => { setViewMode(value); setFilter('all'); }}
                  style={{
                    padding: '8px 20px', fontSize: 14, fontWeight: viewMode === value ? 600 : 400,
                    color: viewMode === value ? '#FF6B2C' : '#6B7280',
                    borderBottom: viewMode === value ? '2px solid #FF6B2C' : '2px solid transparent',
                    background: 'transparent', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                    cursor: 'pointer', transition: 'color .2s',
                    marginBottom: -1,
                  }}
                >{label}</button>
              ))}
            </div>
          )}

          {/* ── Filter chips ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {FILTER_OPTIONS.map((opt) => {
              const active = filter === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  style={{
                    height: 32, padding: '0 14px',
                    borderRadius: 9999, fontSize: 13, fontWeight: active ? 500 : 400,
                    border: active ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    background: active ? 'rgba(255,107,44,0.10)' : '#1A1A17',
                    color: active ? '#FF6B2C' : '#6B7280',
                    cursor: 'pointer',
                    transition: 'all .2s ease',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* ── Content ── */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <Spinner size="md" />
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(239,68,68,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 12 }}>{error}</p>
              <button onClick={fetchTasks} style={{ fontSize: 13, color: '#FF6B2C', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>重新加载</button>
            </div>
          ) : filtered.length === 0 ? (
            /* ── Empty state ── */
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: '#1A1A17', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="16" x2="12" y2="16"/>
                </svg>
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#F0EDE8', marginBottom: 6 }}>还没有任务记录</p>
              <p style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 20 }}>去 Agent 交给 ORANGEBENCH 一个任务吧</p>
              <a
                href="/agent"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  height: 36, padding: '0 18px',
                  borderRadius: 9999, fontSize: 14, fontWeight: 500,
                  background: '#FF6B2C', color: '#fff',
                  textDecoration: 'none',
                  transition: 'background .2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#E85A1A')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#FF6B2C')}
              >
                去 Agent
              </a>
            </div>
          ) : (
            /* ── Task card list ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filtered.map((t) => {
                const isTeam = viewMode === 'team';
                const failed = isTeam ? false : t.status === 'failed';
                const completed = isTeam ? t.status === 'completed' : t.status === 'completed';
                const running = isTeam ? ['assigned', 'in_progress', 'revision'].includes(t.status) : isRunning(t.status);
                const displayTitle = t.title || t.input?.slice(0, 60) || '未命名任务';
                const detailUrl = isTeam ? `/workspace/tasks/${t.id}` : `/tasks/${t.id}`;
                const displayInput = t.input && t.input !== displayTitle ? t.input.slice(0, 100) : '';

                const actionBtnStyle: React.CSSProperties = {
                  height: 30, padding: '0 12px',
                  borderRadius: 9999, fontSize: 12, fontWeight: 500,
                  border: '1px solid rgba(255,255,255,0.06)', background: '#1A1A17',
                  color: '#6B7280', textDecoration: 'none', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center',
                  transition: 'border-color .2s, background .2s, color .2s',
                };
                const hoverIn = (e: React.MouseEvent<HTMLElement>) => {
                  e.currentTarget.style.borderColor = 'rgba(255,107,44,0.3)';
                  e.currentTarget.style.background = 'rgba(255,107,44,0.06)';
                  e.currentTarget.style.color = '#FF6B2C';
                };
                const hoverOut = (e: React.MouseEvent<HTMLElement>) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.background = '#FFFFFF';
                  e.currentTarget.style.color = '#6B7280';
                };

                return (
                  <div
                    key={t.id}
                    style={{
                      background: '#1A1A17',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 16,
                      padding: 18,
                      minHeight: 96,
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'transform .2s ease, box-shadow .2s ease',
                      cursor: 'default',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, width: '100%' }}>
                      {/* Left: content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Title row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: displayInput ? 6 : 0 }}>
                          <p style={{
                            fontSize: 17, fontWeight: 600, color: '#F0EDE8',
                            margin: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', flex: 1, minWidth: 0,
                          }}>
                            {displayTitle}
                          </p>
                          <StatusBadge status={t.status} />
                        </div>

                        {/* Input summary — max 2 lines */}
                        {displayInput && (
                          <p style={{
                            fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.5,
                            overflow: 'hidden', display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          }}>
                            {displayInput}
                          </p>
                        )}

                        {/* Time — fixed below, 8px gap from summary */}
                        <span style={{ display: 'block', fontSize: 12, color: '#6B7280', marginTop: 8 }}>
                          {timeAgo(t.updatedAt || t.createdAt)}
                        </span>

                        {/* Failed: friendly message */}
                        {failed && (
                          <p style={{ fontSize: 12, color: '#B91C1C', marginTop: 6 }}>
                            当前能力暂不可用 · 请稍后重试，或联系管理员启用该能力
                          </p>
                        )}
                      </div>

                      {/* Right: action buttons — unified style */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {failed && (
                          <button
                            onClick={() => handleRetry(t.id)}
                            disabled={retrying === t.id}
                            aria-label="重试任务"
                            style={{ ...actionBtnStyle, color: '#B91C1C', opacity: retrying === t.id ? 0.5 : 1 }}
                            onMouseEnter={hoverIn}
                            onMouseLeave={(e) => { hoverOut(e); e.currentTarget.style.color = '#B91C1C'; }}
                          >
                            {retrying === t.id ? '重试中...' : '重试'}
                          </button>
                        )}
                        {failed && (
                          <a href={detailUrl} style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                            查看详情
                          </a>
                        )}
                        {completed && t.conversationId && (
                          <a href={`/agent?conversationId=${t.conversationId}`} style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                            继续对话
                          </a>
                        )}
                        {completed && (
                          <a href={detailUrl} style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                            查看结果
                          </a>
                        )}
                        {running && t.conversationId && (
                          <a href={`/agent?conversationId=${t.conversationId}`} style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                            查看进度
                          </a>
                        )}
                      </div>
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

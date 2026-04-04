'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { MAIN_NAV } from '@/lib/nav';

interface ReviewTask {
  id: string;
  title: string;
  input: string;
  result: unknown;
  status: string;
  type?: string;
  updatedAt: string;
  createdAt: string;
  conversationId?: string;
}

const STATUS_LABEL: Record<string, string> = {
  queued: '排队中', understanding: '理解中', running: '执行中',
  executing: '执行中', interacting: '等待确认', structuring: '规划中',
  completed: '已完成', failed: '失败', cancelled: '已取消',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days} 天前` : new Date(dateStr).toLocaleDateString('zh-CN');
}

function extractPreview(result: unknown): string {
  if (!result) return '';
  if (typeof result === 'string') return result.slice(0, 200);
  const r = result as Record<string, unknown>;
  if (r.optimizedContent) return String(r.optimizedContent).slice(0, 200);
  if (r.content && typeof r.content === 'object') {
    const c = r.content as Record<string, unknown>;
    const subject = c.subject ? `主题：${c.subject}` : '';
    const body = c.body ? String(c.body).slice(0, 150) : '';
    return [subject, body].filter(Boolean).join('\n');
  }
  if (r.content) return String(r.content).slice(0, 200);
  if (r.text) return String(r.text).slice(0, 200);
  if (r.summary) return String(r.summary).slice(0, 200);
  return '';
}

const WS_STATUS_LABEL: Record<string, string> = {
  draft: '草稿', assigned: '已分配', in_progress: '进行中',
  submitted: '已提交', revision: '需修改', completed: '已完成',
};

function StatusBadge({ status }: { status: string }) {
  const isRunning = ['queued', 'understanding', 'running', 'executing', 'interacting', 'structuring', 'assigned', 'in_progress'].includes(status);
  const isCompleted = status === 'completed';
  const isReview = ['submitted', 'revision'].includes(status);
  const isFailed = status === 'failed';
  let bg = 'rgba(156,163,175,0.10)'; let color = '#6B7280';
  if (isRunning)   { bg = 'rgba(255,122,26,0.10)'; color = '#C2410C'; }
  if (isCompleted) { bg = 'rgba(16,185,129,0.10)'; color = '#047857'; }
  if (isFailed)    { bg = 'rgba(239,68,68,0.10)';  color = '#B91C1C'; }
  if (isReview)    { bg = 'rgba(59,130,246,0.10)';  color = '#1D4ED8'; }
  const label = WS_STATUS_LABEL[status] || STATUS_LABEL[status] || status;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', fontSize: 11, fontWeight: 500, borderRadius: 9999, background: bg, color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

type FilterType = 'all' | 'completed' | 'running' | 'failed';
const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'completed', label: '已完成' },
  { value: 'running', label: '执行中' },
  { value: 'failed', label: '失败' },
];

export default function ReviewPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [wsTasks, setWsTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'personal' | 'team'>('personal');
  const [hasWorkspace, setHasWorkspace] = useState(false);

  useEffect(() => {
    const m = document.cookie.match(/ob-user-id=([^;]+)/);
    if (!m || !m[1]) { router.replace('/login'); }
  }, [router]);

  const fetchTasks = useCallback(() => {
    setLoading(true);
    fetch('/api/tasks/mine')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setTasks(data);
        else if (Array.isArray(data.tasks)) setTasks(data.tasks);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Fetch workspace tasks for team review view
  useEffect(() => {
    fetch('/api/workspace').then(r => r.json()).then(d => {
      if (d?.id) {
        setHasWorkspace(true);
        fetch('/api/workspace/tasks').then(r => r.json()).then(wt => {
          if (Array.isArray(wt)) {
            // Team review shows: submitted (needs review), revision (sent back), in_progress (being worked on)
            const reviewable = wt.filter((t: { businessStatus: string }) =>
              ['submitted', 'revision', 'in_progress', 'assigned'].includes(t.businessStatus)
            );
            setWsTasks(reviewable.map((t: Record<string, unknown>) => ({
              id: t.id as string,
              title: t.title as string,
              input: (t.description as string) || '',
              result: null,
              status: t.businessStatus as string,
              updatedAt: t.updatedAt as string,
              createdAt: t.createdAt as string,
              conversationId: undefined,
            })));
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleRetry(taskId: string) {
    setRetrying(taskId);
    try {
      const r = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'queued' }),
      });
      if (r.ok) { showToast('已重新提交'); fetchTasks(); }
      else showToast('重试失败');
    } catch { showToast('网络错误'); }
    finally { setRetrying(null); }
  }

  const isRunning = (s: string) => ['queued', 'understanding', 'running', 'executing', 'interacting', 'structuring'].includes(s);

  const activeTasks = viewMode === 'team' ? wsTasks : tasks;
  const filtered = activeTasks.filter(t => {
    if (viewMode === 'team') {
      if (filter === 'completed') return false; // team view has no completed
      if (filter === 'running' && !['in_progress', 'assigned'].includes(t.status)) return false;
      if (filter === 'failed' && t.status !== 'revision') return false; // revision = needs attention
    } else {
      if (filter === 'completed' && t.status !== 'completed') return false;
      if (filter === 'running' && !isRunning(t.status)) return false;
      if (filter === 'failed' && t.status !== 'failed') return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(t.title || '').toLowerCase().includes(q) && !(t.input || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const headerBar = (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 52, padding: '0 32px',
      borderBottom: '1px solid #E7E5E1',
      background: '#F7F7F4', flexShrink: 0,
    }}>
      <a href="/agent" style={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}>
        <span style={{ color: '#F97316', fontWeight: 700, fontSize: 15 }}>ORANGE</span>
        <span style={{ color: '#171717', fontWeight: 700, fontSize: 15 }}>BENCH</span>
      </a>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {MAIN_NAV.map(n => {
          const active = n.href === '/review';
          return active ? (
            <span key={n.href} style={{ fontSize: 13, fontWeight: 600, color: '#F97316', padding: '4px 10px', borderRadius: 8, background: 'rgba(255,122,26,0.10)' }}>{n.label}</span>
          ) : (
            <a key={n.href} href={n.href} style={{ fontSize: 13, color: '#9CA3AF', textDecoration: 'none', padding: '4px 10px', borderRadius: 8, transition: 'color .2s' }}>{n.label}</a>
          );
        })}
      </nav>
    </header>
  );

  const actionBtnStyle: React.CSSProperties = {
    height: 30, padding: '0 12px', borderRadius: 9999,
    fontSize: 12, fontWeight: 500,
    border: '1px solid #E7E5E1', background: '#FFFFFF',
    color: '#6B7280', textDecoration: 'none', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center',
    transition: 'border-color .2s, background .2s, color .2s',
  };
  const hoverIn = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,122,26,0.3)';
    e.currentTarget.style.background = 'rgba(255,122,26,0.06)';
    e.currentTarget.style.color = '#F97316';
  };
  const hoverOut = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = '#E7E5E1';
    e.currentTarget.style.background = '#FFFFFF';
    e.currentTarget.style.color = '#6B7280';
  };

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F7F7F4' }}>
      {headerBar}

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 32px 60px' }}>

          {/* Top area */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <h1 style={{ fontSize: 32, fontWeight: 600, color: '#171717', lineHeight: 1.2, margin: 0 }}>处理</h1>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input
                type="text"
                placeholder="搜索任务..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="搜索任务"
                style={{
                  width: 220, height: 36, borderRadius: 12,
                  border: '1px solid #E7E5E1', background: '#FFFFFF',
                  padding: '0 12px 0 34px', fontSize: 13,
                  color: '#171717', outline: 'none',
                  transition: 'border-color .2s, box-shadow .2s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,122,26,0.12)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E7E5E1'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>
          <p style={{ fontSize: 14, color: '#7A7A7A', margin: '0 0 16px' }}>查看需要你确认、继续或处理的任务</p>

          {/* View mode tabs */}
          {hasWorkspace && (
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #E7E5E1' }}>
              {([['personal', '个人'], ['team', '团队']] as const).map(([value, label]) => (
                <button key={value} onClick={() => { setViewMode(value); setFilter('all'); }}
                  style={{
                    padding: '8px 20px', fontSize: 14, fontWeight: viewMode === value ? 600 : 400,
                    color: viewMode === value ? '#F97316' : '#6B7280',
                    borderBottom: viewMode === value ? '2px solid #F97316' : '2px solid transparent',
                    background: 'transparent', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                    cursor: 'pointer', transition: 'color .2s', marginBottom: -1,
                  }}
                >{label}</button>
              ))}
            </div>
          )}

          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                style={{
                  height: 32, padding: '0 14px', borderRadius: 9999,
                  fontSize: 13, fontWeight: filter === f.value ? 500 : 400,
                  border: filter === f.value ? 'none' : '1px solid #E7E5E1',
                  background: filter === f.value ? 'rgba(255,122,26,0.10)' : '#FFFFFF',
                  color: filter === f.value ? '#F97316' : '#6B7280',
                  cursor: 'pointer', transition: 'all .2s',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <Spinner size="md" />
            </div>
          ) : filtered.length === 0 ? (
            /* Empty state */
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: '#FFFFFF', border: '1px solid #E7E5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#171717', marginBottom: 6 }}>当前没有需要处理的任务</p>
              <p style={{ fontSize: 14, color: '#7A7A7A', marginBottom: 20 }}>新的完成结果、失败任务或执行中的项目会出现在这里</p>
              <a
                href="/tasks"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  height: 36, padding: '0 18px', borderRadius: 9999,
                  fontSize: 14, fontWeight: 500,
                  background: '#F97316', color: '#fff', textDecoration: 'none',
                  transition: 'background .2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#E8680F')}
                onMouseLeave={e => (e.currentTarget.style.background = '#F97316')}
              >
                去 Tasks
              </a>
            </div>
          ) : (
            /* Card list */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filtered.map(t => {
                const isTeam = viewMode === 'team';
                const completed = t.status === 'completed';
                const failed = isTeam ? false : t.status === 'failed';
                const running = isTeam ? ['in_progress', 'assigned'].includes(t.status) : isRunning(t.status);
                const isSubmitted = isTeam && t.status === 'submitted';
                const isRevision = isTeam && t.status === 'revision';
                const title = t.title || t.input?.slice(0, 60) || '未命名任务';
                const inputSummary = t.input && t.input !== title ? t.input.slice(0, 100) : '';
                const preview = completed ? extractPreview(t.result) : '';
                const detailUrl = isTeam ? `/workspace/tasks/${t.id}` : `/tasks/${t.id}`;

                return (
                  <div
                    key={t.id}
                    style={{
                      background: '#FFFFFF', border: '1px solid #E7E5E1',
                      borderRadius: 16, padding: 18, minHeight: 124,
                      transition: 'transform .2s, box-shadow .2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ display: 'flex', gap: 16 }}>
                      {/* Left: info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <p style={{ fontSize: 17, fontWeight: 600, color: '#171717', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                            {title}
                          </p>
                          <StatusBadge status={t.status} />
                        </div>

                        {inputSummary && (
                          <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 6px', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {inputSummary}
                          </p>
                        )}

                        <span style={{ display: 'block', fontSize: 12, color: '#A3A3A3', marginTop: 4 }}>
                          {timeAgo(t.updatedAt || t.createdAt)}
                        </span>

                        {/* Result preview for completed */}
                        {completed && preview && (
                          <div style={{
                            background: '#FBFBFA', borderRadius: 12,
                            padding: '12px 14px', marginTop: 10,
                            fontSize: 13, color: '#404040', lineHeight: 1.7,
                            overflow: 'hidden', display: '-webkit-box',
                            WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                          }}>
                            {preview}
                          </div>
                        )}

                        {/* Running status */}
                        {running && !isTeam && (
                          <p style={{ fontSize: 13, color: '#C2410C', marginTop: 8 }}>
                            AI 正在继续处理这项任务
                          </p>
                        )}

                        {/* Team: submitted = needs review */}
                        {isSubmitted && (
                          <p style={{ fontSize: 13, color: '#1D4ED8', marginTop: 8 }}>已提交，等待审核</p>
                        )}

                        {/* Team: revision = sent back */}
                        {isRevision && (
                          <p style={{ fontSize: 13, color: '#B91C1C', marginTop: 8 }}>已退回修改，等待重新提交</p>
                        )}

                        {/* Team: running = member working */}
                        {running && isTeam && (
                          <p style={{ fontSize: 13, color: '#C2410C', marginTop: 8 }}>成员正在处理中</p>
                        )}

                        {/* Failed message */}
                        {failed && (
                          <p style={{ fontSize: 12, color: '#B91C1C', marginTop: 8 }}>
                            当前能力暂不可用 · 请稍后重试，或联系管理员启用该能力
                          </p>
                        )}
                      </div>

                      {/* Right: actions — pinned bottom-right */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, justifyContent: 'flex-end' }}>
                        {/* Team mode: all actions point to workspace detail */}
                        {isTeam && (
                          <a href={detailUrl} style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                            {isSubmitted ? '去审核' : '查看详情'}
                          </a>
                        )}
                        {/* Personal mode: existing actions */}
                        {!isTeam && completed && (
                          <>
                            <a href={detailUrl} style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>查看结果</a>
                            {t.conversationId && <a href={`/agent?conversationId=${t.conversationId}`} style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>继续对话</a>}
                          </>
                        )}
                        {!isTeam && running && (
                          <a href={detailUrl} style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>查看进度</a>
                        )}
                        {!isTeam && failed && (
                          <>
                            <button
                              onClick={() => handleRetry(t.id)}
                              disabled={retrying === t.id}
                              aria-label="重试"
                              style={{ ...actionBtnStyle, color: '#B91C1C', opacity: retrying === t.id ? 0.5 : 1 }}
                              onMouseEnter={hoverIn}
                              onMouseLeave={e => { hoverOut(e); e.currentTarget.style.color = '#B91C1C'; }}
                            >
                              {retrying === t.id ? '重试中...' : '重试'}
                            </button>
                            <a href={detailUrl} style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>查看详情</a>
                          </>
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

      {/* Toast */}
      {toast && (
        <div className="animate-flow-in" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 60, padding: '10px 20px', borderRadius: 9999,
          background: 'rgba(34,197,94,0.92)', color: '#fff', fontSize: 13,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

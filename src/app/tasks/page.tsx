'use client';
import { useEffect, useState, useCallback } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { NavHeader } from '@/components/NavHeader';

interface TaskItem {
  id: string;
  title: string;
  type?: string;
  status: string;
  input?: string;
  priority?: number;
  createdAt: string;
  updatedAt?: string;
}

const STATUS_LABEL: Record<string, string> = {
  queued: '排队中', understanding: '理解中', running: 'AI执行中',
  executing: 'AI执行中', interacting: '等待确认', structuring: '规划中',
  completed: '已完成', failed: '执行失败', cancelled: '已取消',
};

const STATUS_COLOR: Record<string, string> = {
  queued: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  understanding: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  running: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  executing: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  interacting: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  structuring: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  completed: 'bg-green-500/10 text-green-400 border border-green-500/20',
  failed: 'bg-red-500/10 text-red-400 border border-red-500/20',
  cancelled: 'bg-surface-tertiary text-content-tertiary border border-border/50',
};

const STATUS_DOT: Record<string, string> = {
  queued: 'bg-blue-400', understanding: 'bg-blue-400 animate-pulse',
  running: 'bg-amber-400 animate-pulse', executing: 'bg-amber-400 animate-pulse',
  interacting: 'bg-purple-400 animate-pulse', structuring: 'bg-blue-400 animate-pulse',
  completed: 'bg-green-400', failed: 'bg-red-400', cancelled: 'bg-content-tertiary',
};

const TYPE_LABEL: Record<string, string> = {
  ppt: '演示文稿', email: '邮件', proposal: '方案',
  website: '网页', video: '视频', unknown: '任务', direct: '任务',
};

function TypeIcon({ type }: { type?: string }) {
  const s = { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (type === 'ppt') return <svg {...s}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
  if (type === 'email') return <svg {...s}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
  if (type === 'proposal') return <svg {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
  return <svg {...s}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="16" x2="12" y2="16"/></svg>;
}

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

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [retrying, setRetrying] = useState<string | null>(null);

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

  const isRunning = (s: string) => ['queued', 'understanding', 'running', 'executing', 'interacting', 'structuring'].includes(s);

  const filtered = tasks.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'running') return isRunning(t.status);
    if (filter === 'completed') return t.status === 'completed';
    if (filter === 'failed') return t.status === 'failed';
    return true;
  });

  const countFor = (f: FilterType) => {
    if (f === 'all') return tasks.length;
    if (f === 'running') return tasks.filter(t => isRunning(t.status)).length;
    if (f === 'completed') return tasks.filter(t => t.status === 'completed').length;
    if (f === 'failed') return tasks.filter(t => t.status === 'failed').length;
    return 0;
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-surface-primary">
      <NavHeader />
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-content-primary">我的任务</h1>
              <p className="text-xs text-content-tertiary mt-0.5">所有 AI 任务的执行记录与结果</p>
            </div>
            <a
              href="/agent"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-80"
              style={{ background: 'var(--accent, #f97316)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              新建任务
            </a>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  filter === opt.value
                    ? 'text-white font-medium'
                    : 'bg-surface-secondary text-content-tertiary hover:text-content-primary border border-border/50'
                }`}
                style={filter === opt.value ? { background: 'var(--accent, #f97316)' } : {}}
              >
                {opt.label}
                <span className="ml-1 opacity-60">({countFor(opt.value)})</span>
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size="md" /></div>
          ) : error ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <p className="text-content-tertiary text-sm">{error}</p>
              <button onClick={fetchTasks} className="text-xs text-accent hover:underline">重新加载</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-surface-secondary border border-border/50 flex items-center justify-center mx-auto">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary, #888)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="16" x2="12" y2="16"/>
                </svg>
              </div>
              <div className="space-y-1">
                <p className="text-content-secondary text-sm font-medium">
                  {filter === 'all' ? '你现在没有任何任务' : `没有${FILTER_OPTIONS.find(o => o.value === filter)?.label}任务`}
                </p>
                <p className="text-content-tertiary text-xs">
                  {filter === 'all' ? '把你的工作交给 AI，去创建第一个任务吧' : '换个筛选条件，或者去创建一个新任务'}
                </p>
              </div>
              {filter === 'all' ? (
                <a href="/agent" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white hover:opacity-80 transition-opacity" style={{ background: 'var(--accent, #f97316)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  创建第一个任务
                </a>
              ) : (
                <button onClick={() => setFilter('all')} className="text-accent text-xs hover:underline">查看全部任务</button>
              )}
            </div>
          ) : (
            /* Card grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((t) => (
                <div
                  key={t.id}
                  className="group rounded-2xl border border-border/50 bg-surface-secondary p-4 hover:bg-surface-tertiary hover:border-accent/20 transition-all duration-150 space-y-3"
                >
                  {/* Card top: type icon + status badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-content-tertiary">
                      <TypeIcon type={t.type} />
                      <span className="text-[11px]">{TYPE_LABEL[t.type || ''] || '任务'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(t.priority ?? 0) >= 2 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-0.5">
                          <span className="w-1 h-1 rounded-full bg-red-400" />
                          高优先
                        </span>
                      )}
                      {(t.priority ?? 0) === 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-0.5">
                          <span className="w-1 h-1 rounded-full bg-amber-400" />
                          中优先
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1 ${STATUS_COLOR[t.status] || 'bg-surface-tertiary text-content-tertiary border border-border/50'}`}>
                        <span className={`w-1 h-1 rounded-full flex-shrink-0 ${STATUS_DOT[t.status] || 'bg-content-tertiary'}`} />
                        {STATUS_LABEL[t.status] || t.status}
                      </span>
                    </div>
                  </div>

                  {/* Card title */}
                  <p className="text-sm font-medium text-content-primary line-clamp-2 leading-snug group-hover:text-accent transition-colors">
                    {t.title || t.input?.slice(0, 60) || '未命名任务'}
                  </p>

                  {/* Card footer: time + actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/30">
                    <span className="text-[11px] text-content-tertiary">{timeAgo(t.updatedAt || t.createdAt)}</span>
                    <div className="flex items-center gap-1.5">
                      {t.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(t.id)}
                          disabled={retrying === t.id}
                          className="text-[11px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          {retrying === t.id ? '重试中...' : '重试'}
                        </button>
                      )}
                      {isRunning(t.status) && (
                        <a href={`/agent?task=${t.id}`} className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors">
                          继续
                        </a>
                      )}
                      <a href={`/tasks/${t.id}`} className="text-[11px] text-accent hover:underline">查看</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

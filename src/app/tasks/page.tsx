'use client';
import { useEffect, useState, useCallback } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { NavHeader } from '@/components/NavHeader';

interface TaskItem {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  queued: '排队中',
  understanding: '理解中',
  running: 'AI执行中',
  executing: 'AI执行中',
  interacting: 'AI执行中',
  completed: '已完成',
  failed: '执行失败',
};

const STATUS_COLOR: Record<string, string> = {
  queued: 'bg-amber-500/10 text-amber-400',
  understanding: 'bg-blue-500/10 text-blue-400',
  running: 'bg-blue-500/10 text-blue-400',
  executing: 'bg-blue-500/10 text-blue-400',
  interacting: 'bg-blue-500/10 text-blue-400',
  completed: 'bg-green-500/10 text-green-400',
  failed: 'bg-red-500/10 text-red-400',
};

type FilterType = 'all' | 'running' | 'completed' | 'failed';

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'running', label: '执行中' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
];

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchTasks = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/tasks/mine')
      .then((r) => {
        if (!r.ok) throw new Error('加载失败');
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setTasks(data);
        else setError('数据格式异常');
      })
      .catch(() => setError('网络错误，请刷新重试'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const isRunning = (s: string) => ['queued', 'understanding', 'running', 'executing', 'interacting'].includes(s);

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
        <div className="max-w-3xl mx-auto px-4 md:px-0 py-6 space-y-4">

          {/* Header row */}
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold text-content-primary">我的任务</h1>
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
                <span className="ml-1 opacity-70">({countFor(opt.value)})</span>
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size="md" /></div>
          ) : error ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-content-tertiary text-sm">{error}</p>
              <button onClick={fetchTasks} className="text-xs text-accent hover:underline">重新加载</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-content-tertiary text-sm">
                {filter === 'all' ? '暂无任务记录' : `暂无${FILTER_OPTIONS.find(o => o.value === filter)?.label}任务`}
              </p>
              {filter === 'all' ? (
                <a href="/agent" className="text-accent text-xs hover:underline">去创建第一个任务 →</a>
              ) : (
                <button onClick={() => setFilter('all')} className="text-accent text-xs hover:underline">查看全部任务</button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => (
                <a
                  key={t.id}
                  href={`/tasks/${t.id}`}
                  className="block rounded-xl border border-border/50 bg-surface-secondary p-4 hover:bg-surface-tertiary transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-content-primary truncate">
                        {t.title || '未命名任务'}
                      </div>
                      <div className="text-xs text-content-tertiary mt-1">
                        {new Date(t.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[t.status] || 'bg-surface-tertiary text-content-tertiary'}`}>
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

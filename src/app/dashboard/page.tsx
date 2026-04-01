'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';

interface TaskRef {
  id: string;
  title: string;
  type: string;
  status?: string;
  priority?: number;
  updatedAt?: string;
  createdAt?: string;
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
}

const STATUS_LABEL: Record<string, string> = {
  queued: '排队中', running: 'AI执行中', executing: 'AI执行中',
  interacting: '等待确认', completed: '已完成', failed: '执行失败',
};

const STATUS_DOT: Record<string, string> = {
  queued: 'bg-blue-400 animate-pulse', running: 'bg-amber-400 animate-pulse',
  executing: 'bg-amber-400 animate-pulse', interacting: 'bg-purple-400 animate-pulse',
  completed: 'bg-green-400', failed: 'bg-red-400',
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

export default function DashboardPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/summary')
      .then((r) => { if (!r.ok) throw new Error('加载失败'); return r.json(); })
      .then(setData)
      .catch(() => setError('数据加载失败，请刷新重试'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-screen bg-surface-primary flex flex-col">
        <NavHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-screen bg-surface-primary flex flex-col">
        <NavHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-content-tertiary text-sm">{error || '数据加载失败'}</p>
          <button onClick={() => window.location.reload()} className="text-xs text-accent hover:underline">刷新页面</button>
        </div>
      </div>
    );
  }

  const waitingCount = data.waitingReviewTasks?.length ?? 0;
  const highPriorityCount = data.highPriorityTasks?.length ?? 0;
  const needAction = waitingCount + (data.failed > 0 ? 1 : 0);

  return (
    <div className="min-h-screen bg-surface-primary">
      <NavHeader />
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-content-primary">指挥台</h1>
            <p className="text-xs text-content-tertiary mt-0.5">
              {needAction > 0 ? `有 ${needAction} 件事需要你处理` : '一切正常，继续推进'}
            </p>
          </div>
          <Link
            href="/agent"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: 'var(--accent, #f97316)' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            新建任务
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="全部任务" value={data.total} color="text-content-primary" href="/tasks" />
          <StatCard label="执行中" value={data.running} color="text-amber-400" href="/tasks?filter=running" />
          <StatCard label="已完成" value={data.completed} color="text-green-400" href="/tasks?filter=completed" />
          <StatCard label="执行失败" value={data.failed} color="text-red-400" href="/tasks?filter=failed" />
        </div>

        {/* Empty state */}
        {data.total === 0 && (
          <div className="rounded-2xl border border-border/50 bg-surface-secondary p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent,#f97316)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <p className="text-content-secondary text-sm font-medium">还没有任何任务</p>
            <p className="text-content-tertiary text-xs">告诉 AI 你的需求，它会帮你完成</p>
            <Link href="/agent" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white hover:opacity-80 transition-opacity" style={{ background: 'var(--accent, #f97316)' }}>
              创建第一个任务
            </Link>
          </div>
        )}

        {/* 需要你处理 */}
        {(waitingCount > 0 || data.failed > 0) && (
          <Section title="需要你处理" icon="alert" badge={needAction}>
            {(data.waitingReviewTasks ?? []).map(t => (
              <TaskRow key={t.id} task={t} badge="待审核" badgeColor="bg-amber-500/10 text-amber-400 border-amber-500/20" href="/review" />
            ))}
            {data.failed > 0 && (
              <Link href="/tasks?filter=failed" className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 transition-colors group">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span className="text-sm text-content-secondary">{data.failed} 个任务执行失败</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">查看</span>
              </Link>
            )}
          </Section>
        )}

        {/* 高优先级任务 */}
        {highPriorityCount > 0 && (
          <Section title="高优先级任务" icon="fire" badge={highPriorityCount}>
            {(data.highPriorityTasks ?? []).map(t => (
              <TaskRow key={t.id} task={t} badge="高优先" badgeColor="bg-red-500/10 text-red-400 border-red-500/20" href={`/tasks/${t.id}`} showStatus />
            ))}
          </Section>
        )}

        {/* 最近活跃 */}
        {(data.recentTasks ?? []).length > 0 && (
          <Section title="最近活跃" icon="clock">
            {(data.recentTasks ?? []).map(t => (
              <TaskRow key={t.id} task={t} href={`/tasks/${t.id}`} showStatus showTime />
            ))}
            <Link href="/tasks" className="block text-center text-xs text-accent hover:underline pt-1">查看全部任务</Link>
          </Section>
        )}

        {/* AI 建议 */}
        {data.aiSuggestions.length > 0 && (
          <Section title="AI 建议你现在做什么" icon="spark">
            <div className="space-y-2">
              {data.aiSuggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-surface-tertiary/50 border border-border/30">
                  <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center text-[10px] text-accent font-semibold">{i + 1}</span>
                  <p className="text-sm text-content-secondary leading-snug">{s}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 已完成快捷入口 */}
        {data.completed > 0 && (
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-between">
            <p className="text-sm text-green-400">{data.completed} 个任务已完成</p>
            <Link href="/review" className="text-xs text-accent hover:underline">去审核</Link>
          </div>
        )}

        {/* 自动任务暂停提示 */}
        {data.pausedAutoTasks > 0 && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
            <p className="text-sm text-amber-400">{data.pausedAutoTasks} 个自动任务已暂停</p>
            <p className="text-xs text-content-tertiary">免费版自动任务限运行 3 次，开通 Basic 可无限运行</p>
            <Link href="/billing" className="text-xs text-accent inline-block">开通 Basic（¥39/月）</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, href }: { label: string; value: number; color: string; href?: string }) {
  const inner = (
    <>
      <p className="text-xs text-content-tertiary mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="block p-4 rounded-xl border border-border bg-surface-secondary hover:bg-surface-tertiary transition-colors">
        {inner}
      </Link>
    );
  }
  return <div className="p-4 rounded-xl border border-border bg-surface-secondary">{inner}</div>;
}

function TaskRow({ task, badge, badgeColor, href, showStatus, showTime }: {
  task: TaskRef; badge?: string; badgeColor?: string; href: string; showStatus?: boolean; showTime?: boolean;
}) {
  return (
    <Link href={href} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-secondary/60 border border-border/30 hover:bg-surface-secondary hover:border-accent/20 transition-colors group">
      <div className="flex items-center gap-2 min-w-0">
        {showStatus && task.status && (
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[task.status] || 'bg-content-tertiary'}`} />
        )}
        <span className="text-sm text-content-secondary truncate group-hover:text-content-primary transition-colors">
          {task.title}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {showTime && (task.updatedAt || task.createdAt) && (
          <span className="text-[11px] text-content-tertiary">{timeAgo(task.updatedAt || task.createdAt)}</span>
        )}
        {showStatus && task.status && (
          <span className="text-[10px] text-content-tertiary">{STATUS_LABEL[task.status] || task.status}</span>
        )}
        {badge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeColor || 'bg-surface-tertiary text-content-tertiary border-border/50'}`}>{badge}</span>
        )}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-content-tertiary/40 group-hover:text-accent/60 transition-colors">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </Link>
  );
}

function SectionIcon({ name }: { name: string }) {
  const s = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'alert') return <svg {...s} stroke="#f59e0b"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
  if (name === 'fire')  return <svg {...s} stroke="#f87171"><path d="M12 2c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 14.5c-2.5 0-4.5-2-4.5-4.5 0-1.5.7-2.8 1.8-3.7.3 1.1 1.2 2 2.2 2.2-.2-.7-.3-1.4-.3-2.1 0-1.7.8-3.2 2-4.2.5 1.5 1.5 2.7 2.8 3.4-.3.6-.5 1.3-.5 2 0 2.5-2 4.9-3.5 6.9z"/></svg>;
  if (name === 'clock') return <svg {...s} stroke="#94a3b8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
  if (name === 'spark') return <svg {...s} stroke="#f97316"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
  return null;
}

function Section({ title, icon, badge, children }: { title: string; icon: string; badge?: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <SectionIcon name={icon} />
        <h2 className="text-sm font-medium text-content-primary">{title}</h2>
        {badge !== undefined && badge > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">{badge}</span>
        )}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  failedTasks?: (TaskRef & { errorMessage?: string | null })[];
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
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  // Quick action: approve a waiting_review task
  async function handleApprove(taskId: string) {
    if (actionLoading) return;
    setActionLoading(taskId + '_approve');
    try {
      const r = await fetch(`/api/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalType: 'result', action: 'approve' }),
      });
      if (r.ok) {
        showToast('✓ 已通过审核', true);
        setData(prev => prev ? {
          ...prev,
          waitingReviewTasks: prev.waitingReviewTasks?.filter(t => t.id !== taskId),
        } : prev);
      } else {
        showToast('操作失败，请重试', false);
      }
    } catch {
      showToast('网络错误', false);
    } finally {
      setActionLoading(null);
    }
  }

  // Quick action: retry a failed task
  async function handleRetry(taskId: string) {
    if (actionLoading) return;
    setActionLoading(taskId + '_retry');
    try {
      const r = await fetch(`/api/tasks/${taskId}/retry`, { method: 'POST' });
      if (r.ok) {
        showToast('✓ 已重新提交执行', true);
        loadData();
      } else {
        showToast('重试失败，请稍后再试', false);
      }
    } catch {
      showToast('网络错误', false);
    } finally {
      setActionLoading(null);
    }
  }

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
            <p className="text-xs mt-0.5" style={{ color: needAction > 0 ? '#f59e0b' : 'var(--content-tertiary)' }}>
              {needAction > 0 ? `⚡ 有 ${needAction} 件事需要你处理` : '✓ 一切正常，继续推进'}
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
          <div className="rounded-2xl border border-border/50 bg-surface-secondary p-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent,#f97316)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <div>
              <p className="text-content-primary text-sm font-semibold">你现在没有任何任务</p>
              <p className="text-content-tertiary text-xs mt-1">告诉 AI 你的需求，它会帮你完成工作</p>
            </div>
            <Link href="/agent" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-80 transition-opacity" style={{ background: 'var(--accent, #f97316)' }}>
              去创建第一个任务 →
            </Link>
          </div>
        )}

        {/* 需要你处理 — BLOCKED / WAITING YOU */}
        {(waitingCount > 0 || data.failed > 0) && (
          <Section title="需要你处理" icon="alert" badge={needAction}>
            {(data.waitingReviewTasks ?? []).map(t => (
              <ActionTaskRow
                key={t.id}
                task={t}
                urgencyLabel="WAITING YOU"
                urgencyColor="bg-amber-500/10 text-amber-400 border-amber-500/30"
                urgencyDot="bg-amber-400 animate-pulse"
                detailHref={`/tasks/${t.id}`}
                actionHref="/review"
                actionLabel="立即审核"
                actionStyle="amber"
                onQuickApprove={() => handleApprove(t.id)}
                approveLoading={actionLoading === t.id + '_approve'}
              />
            ))}
            {(data.failedTasks && data.failedTasks.length > 0) ? (
              data.failedTasks.map(t => (
                <div key={t.id} className="rounded-xl bg-red-500/5 border border-red-500/20 overflow-hidden">
                  <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <span className="text-sm text-content-primary font-medium truncate">{t.title}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-semibold flex-shrink-0 ml-2">BLOCKED</span>
                  </div>
                  {t.errorMessage && (
                    <div className="px-3 pb-1.5">
                      <p className="text-[11px] text-red-400/80 truncate">原因：{t.errorMessage}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-2 border-t border-red-500/10 bg-red-500/5">
                    <span className="text-[11px] text-content-tertiary">{timeAgo(t.updatedAt)}</span>
                    <button
                      onClick={() => handleRetry(t.id)}
                      disabled={actionLoading === t.id + '_retry'}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors font-medium disabled:opacity-50"
                    >
                      {actionLoading === t.id + '_retry' ? '重试中...' : '重试'}
                    </button>
                    <Link href={`/tasks/${t.id}`} className="ml-auto text-[11px] text-content-tertiary hover:text-accent transition-colors">查看详情 →</Link>
                  </div>
                </div>
              ))
            ) : data.failed > 0 ? (
              <div className="flex items-center justify-between px-3 py-3 rounded-xl bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-content-secondary font-medium">{data.failed} 个任务执行失败</p>
                    <p className="text-[11px] text-content-tertiary mt-0.5">需要重试或检查原因</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium">BLOCKED</span>
                  <Link href="/tasks?filter=failed" className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors font-medium">立即处理</Link>
                </div>
              </div>
            ) : null}
          </Section>
        )}

        {/* 高优先级任务 */}
        {highPriorityCount > 0 && (
          <Section title="高优先级任务" icon="fire" badge={highPriorityCount}>
            {(data.highPriorityTasks ?? []).map(t => (
              <ActionTaskRow
                key={t.id}
                task={t}
                urgencyLabel="高优先"
                urgencyColor="bg-red-500/10 text-red-400 border-red-500/20"
                urgencyDot="bg-red-400"
                detailHref={`/tasks/${t.id}`}
                actionHref={`/tasks/${t.id}`}
                actionLabel="立即处理"
                actionStyle="red"
                showStatus
                showTime
              />
            ))}
          </Section>
        )}

        {/* 最近活跃 */}
        {(data.recentTasks ?? []).length > 0 && (
          <Section title="最近活跃" icon="clock">
            {(data.recentTasks ?? []).map(t => (
              <TaskRow key={t.id} task={t} href={`/tasks/${t.id}`} showStatus showTime />
            ))}
            <Link href="/tasks" className="block text-center text-xs text-accent hover:underline pt-1">查看全部任务 →</Link>
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

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-white text-sm shadow-lg animate-flow-in ${toast.ok ? 'bg-green-600/90' : 'bg-red-600/90'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ---- ActionTaskRow: task card with urgency label + quick action buttons ----
function ActionTaskRow({
  task, urgencyLabel, urgencyColor, urgencyDot, detailHref, actionHref, actionLabel, actionStyle,
  showStatus, showTime, onQuickApprove, approveLoading,
}: {
  task: TaskRef;
  urgencyLabel: string;
  urgencyColor: string;
  urgencyDot: string;
  detailHref: string;
  actionHref: string;
  actionLabel: string;
  actionStyle: 'amber' | 'red';
  showStatus?: boolean;
  showTime?: boolean;
  onQuickApprove?: () => void;
  approveLoading?: boolean;
}) {
  const btnBase = 'text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-colors';
  const amberBtn = `${btnBase} bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20`;
  const redBtn = `${btnBase} bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20`;
  const primaryBtn = actionStyle === 'amber' ? amberBtn : redBtn;

  return (
    <div className="rounded-xl bg-surface-secondary/60 border border-border/30 overflow-hidden">
      {/* Top row: title + urgency badge */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${urgencyDot}`} />
          <span className="text-sm text-content-primary font-medium truncate">{task.title}</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold flex-shrink-0 ml-2 ${urgencyColor}`}>
          {urgencyLabel}
        </span>
      </div>

      {/* Meta row: time + status */}
      <div className="flex items-center gap-3 px-3 pb-2 text-[11px] text-content-tertiary">
        {(task.updatedAt || task.createdAt) && (
          <span>{timeAgo(task.updatedAt || task.createdAt)}</span>
        )}
        {showStatus && task.status && (
          <span>{STATUS_LABEL[task.status] || task.status}</span>
        )}
      </div>

      {/* Action row: quick buttons + detail link */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/20 bg-surface-tertiary/30">
        {/* Quick approve button (only for waiting_review) */}
        {onQuickApprove && (
          <button
            onClick={onQuickApprove}
            disabled={approveLoading}
            className={`${amberBtn} disabled:opacity-50`}
          >
            {approveLoading ? '处理中...' : '✓ 通过'}
          </button>
        )}
        {/* Primary action button */}
        <Link href={actionHref} className={primaryBtn}>
          {actionLabel}
        </Link>
        {/* Detail link */}
        <Link href={detailHref} className="ml-auto text-[11px] text-content-tertiary hover:text-accent transition-colors">
          查看详情 →
        </Link>
      </div>
    </div>
  );
}

// ---- TaskRow: simple list row ----
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

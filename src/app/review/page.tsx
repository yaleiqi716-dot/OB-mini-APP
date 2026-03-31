'use client';

import { useEffect, useState, useCallback } from 'react';
import { Spinner } from '@/components/ui/Spinner';

interface ReviewTask {
  id: string;
  title: string;
  input: string;
  result: unknown;
  businessStatus: string;
  assigneeId: string | null;
  updatedAt: string;
}

function extractDisplay(result: unknown): string {
  if (!result) return '（无提交内容）';
  if (typeof result === 'string') return result;
  const r = result as Record<string, unknown>;
  if (r.optimizedContent) return String(r.optimizedContent);
  if (r.content && typeof r.content === 'object') {
    const c = r.content as Record<string, unknown>;
    return `${c.subject ? `主题：${c.subject}\n\n` : ''}${c.body || ''}`;
  }
  if (r.content) return String(r.content);
  return JSON.stringify(result, null, 2).slice(0, 2000);
}

export default function ReviewPage() {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchTasks = useCallback(() => {
    fetch('/api/tasks/review')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTasks(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const selected = tasks.find(t => t.id === selectedId) || null;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleAction(taskId: string, action: string) {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/tasks/${taskId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '操作失败');
        return;
      }
      if (action === 'feedback') showToast('已退回给员工修改');
      if (action === 'ai_optimize') showToast('AI优化完成，已通过');
      if (action === 'approve') showToast('已通过');

      // Remove from list & clear selection
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setSelectedId(null);
    } catch {
      showToast('网络错误');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-surface-primary">
      <header className="flex items-center justify-between px-4 md:px-6 h-11 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-accent font-semibold text-sm">ORANGE</span>
          <span className="text-content-primary font-semibold text-sm">BENCH</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-xs text-content-tertiary hover:text-accent transition-colors">决策台</a>
          <a href="/tasks" className="text-xs text-content-tertiary hover:text-accent transition-colors">任务</a>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Task list */}
        <aside className="w-72 border-r border-border/40 overflow-y-auto custom-scrollbar flex-shrink-0">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size="md" /></div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-content-tertiary text-sm">暂无待审核任务</div>
          ) : (
            <div className="p-2 space-y-1">
              {tasks.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left rounded-lg p-3 transition-colors ${
                    selectedId === t.id
                      ? 'bg-accent/10 border border-accent/30'
                      : 'hover:bg-surface-tertiary border border-transparent'
                  }`}
                >
                  <div className="text-sm font-medium text-content-primary truncate">
                    {t.title || '未命名任务'}
                  </div>
                  <div className="text-xs text-content-tertiary mt-1 truncate">
                    {t.assigneeId || '未指派'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Detail */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
                  <h1 className="text-xl font-semibold text-content-primary">
                    {selected.title || '未命名任务'}
                  </h1>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-content-tertiary uppercase tracking-wide">任务要求</div>
                    <div className="rounded-xl bg-surface-secondary border border-border/50 p-4">
                      <p className="text-content-primary text-sm leading-relaxed whitespace-pre-wrap">{selected.input}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-content-tertiary uppercase tracking-wide">员工提交</div>
                    <div className="rounded-xl bg-surface-secondary border border-border/50 p-4">
                      <p className="text-content-primary text-sm leading-relaxed whitespace-pre-wrap">
                        {extractDisplay(selected.result)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="border-t border-border/40 px-4 md:px-6 py-3 bg-surface-primary flex-shrink-0">
                <div className="max-w-3xl mx-auto flex items-center justify-end gap-3">
                  <button
                    onClick={() => handleAction(selected.id, 'feedback')}
                    disabled={!!actionLoading}
                    className="px-4 py-2 rounded-xl border border-border text-content-secondary text-sm hover:bg-surface-tertiary transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'feedback' ? '处理中...' : '让员工修改'}
                  </button>
                  <button
                    onClick={() => handleAction(selected.id, 'ai_optimize')}
                    disabled={!!actionLoading}
                    className="px-4 py-2 rounded-xl bg-blue-500/10 text-blue-400 text-sm hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'ai_optimize' ? 'AI优化中...' : 'AI帮我优化'}
                  </button>
                  <button
                    onClick={() => handleAction(selected.id, 'approve')}
                    disabled={!!actionLoading}
                    className="px-4 py-2 rounded-xl bg-accent text-white text-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'approve' ? '处理中...' : '通过'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-content-tertiary text-sm">
              选择一个任务查看详情
            </div>
          )}
        </main>
      </div>

      {/* Toast */}
      {toast ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-flow-in">
          <div className="px-4 py-2 rounded-lg bg-accent/90 text-white text-sm shadow-lg">{toast}</div>
        </div>
      ) : null}
    </div>
  );
}

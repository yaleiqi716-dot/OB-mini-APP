'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { NavHeader } from '@/components/NavHeader';

interface TaskDetail {
  id: string;
  title: string;
  input: string;
  status: string;
  result: Record<string, unknown> | null;
  preview: boolean;
  unlockCost: number;
  errorMessage: string | null;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '等待中',
  queued: '正在处理',
  understanding: 'AI理解中',
  structuring: 'AI规划中',
  executing: 'AI执行中',
  running: 'AI执行中',
  interacting: '等待输入',
  completed: '已完成',
  failed: '执行失败',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-surface-tertiary text-content-tertiary',
  queued: 'bg-amber-500/10 text-amber-400',
  understanding: 'bg-blue-500/10 text-blue-400',
  structuring: 'bg-blue-500/10 text-blue-400',
  executing: 'bg-blue-500/10 text-blue-400',
  running: 'bg-blue-500/10 text-blue-400',
  interacting: 'bg-purple-500/10 text-purple-400',
  completed: 'bg-green-500/10 text-green-400',
  failed: 'bg-red-500/10 text-red-400',
};

function extractResultText(result: Record<string, unknown> | null): string | null {
  if (!result) return null;
  if (result.type === 'email' && result.content && typeof result.content === 'object') {
    const c = result.content as Record<string, unknown>;
    return `主题：${c.subject || ''}\n\n${c.body || ''}`;
  }
  if (result.optimizedContent && typeof result.optimizedContent === 'string') return result.optimizedContent;
  if (result.content && typeof result.content === 'string') return result.content;
  if (Array.isArray(result.slides)) {
    const slides = result.slides as { title: string; content?: string[] }[];
    return slides.map((s, i) => `第${i + 1}页：${s.title}\n${(s.content || []).join('\n')}`).join('\n\n');
  }
  if (Array.isArray(result.sections)) {
    const sections = result.sections as { heading: string; content?: string }[];
    return sections.map(s => `## ${s.heading}\n${s.content || ''}`).join('\n\n');
  }
  if (result.summary && typeof result.summary === 'string') return result.summary;
  return JSON.stringify(result, null, 2);
}

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.taskId as string;
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const fetchTask = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || '获取任务失败'); return; }
      setTask({
        id: data.id, title: data.title, input: data.input,
        status: data.status || 'queued',
        result: data.result || null, preview: data.preview || false,
        unlockCost: data.unlockCost || 0, errorMessage: data.errorMessage || null,
        assigneeId: data.assigneeId || null,
        createdAt: data.createdAt, updatedAt: data.updatedAt,
      });
    } catch { setError('网络错误'); } finally { setLoading(false); }
  }, [taskId]);

  useEffect(() => { fetchTask(); }, [fetchTask]);

  useEffect(() => {
    if (!task) return;
    const inProgress = ['pending', 'queued', 'understanding', 'structuring', 'executing', 'running', 'interacting'];
    if (!inProgress.includes(task.status)) return;
    const timer = setInterval(fetchTask, 3000);
    return () => clearInterval(timer);
  }, [task, fetchTask]);

  async function handleUnlock() {
    if (unlocking || !task) return;
    setUnlocking(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/unlock`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '解锁失败', false); return; }
      showToast('解锁成功！');
      fetchTask();
    } catch { showToast('网络错误', false); } finally { setUnlocking(false); }
  }

  if (loading) return (
    <div className="h-[100dvh] flex flex-col bg-surface-primary">
      <NavHeader />
      <div className="flex-1 flex items-center justify-center"><Spinner size="md" /></div>
    </div>
  );

  if (error) return (
    <div className="h-[100dvh] flex flex-col bg-surface-primary">
      <NavHeader />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-red-400 text-lg font-medium">{error}</div>
          <a href="/tasks" className="text-accent text-sm hover:underline">返回任务列表</a>
        </div>
      </div>
    </div>
  );

  if (!task) return null;

  const resultText = extractResultText(task.result);
  const isRunning = ['pending', 'queued', 'understanding', 'structuring', 'executing', 'running', 'interacting'].includes(task.status);

  return (
    <div className="h-[100dvh] flex flex-col bg-surface-primary">
      <NavHeader />
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">

          {/* Title + status */}
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl md:text-2xl font-semibold text-content-primary flex-1">
              {task.title || '未命名任务'}
            </h1>
            <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${STATUS_COLOR[task.status] || 'bg-surface-tertiary text-content-tertiary'}`}>
              {STATUS_LABEL[task.status] || task.status}
            </span>
          </div>

          <div className="text-xs text-content-tertiary">
            创建于 {new Date(task.createdAt).toLocaleString('zh-CN')}
          </div>

          {/* Input */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-content-tertiary uppercase tracking-wide">任务要求</div>
            <div className="rounded-xl bg-surface-secondary border border-border/50 p-4">
              <p className="text-content-primary text-sm leading-relaxed whitespace-pre-wrap">{task.input}</p>
            </div>
          </div>

          {/* Running state */}
          {isRunning && (
            <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-4 flex items-center gap-3">
              <Spinner size="sm" />
              <div>
                <p className="text-sm text-blue-400 font-medium">{STATUS_LABEL[task.status] || '处理中'}</p>
                <p className="text-xs text-content-tertiary mt-0.5">页面将自动刷新，请稍候...</p>
              </div>
            </div>
          )}

          {/* Error */}
          {task.status === 'failed' && task.errorMessage && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
              <div className="text-xs font-medium text-red-400 mb-1">执行失败原因</div>
              <p className="text-sm text-content-secondary">{task.errorMessage}</p>
            </div>
          )}

          {/* Result — P0 fix: always show result when completed */}
          {task.status === 'completed' && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-content-tertiary uppercase tracking-wide">AI 生成结果</div>
              {task.preview ? (
                <div className="rounded-xl bg-surface-secondary border border-border/50 p-4 space-y-4">
                  <p className="text-content-primary text-sm leading-relaxed whitespace-pre-wrap">
                    {resultText || '（预览内容）'}
                  </p>
                  <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-content-tertiary">完整内容已锁定，解锁需 {task.unlockCost} credits</p>
                    <button
                      onClick={handleUnlock}
                      disabled={unlocking}
                      className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs hover:bg-accent-hover transition-colors disabled:opacity-50"
                    >
                      {unlocking ? '解锁中...' : `立即解锁（${task.unlockCost} credits）`}
                    </button>
                  </div>
                </div>
              ) : resultText ? (
                <div className="rounded-xl bg-surface-secondary border border-border/50 p-4">
                  <p className="text-content-primary text-sm leading-relaxed whitespace-pre-wrap">{resultText}</p>
                </div>
              ) : (
                <div className="rounded-xl bg-surface-secondary border border-border/50 p-4">
                  <p className="text-content-tertiary text-sm">任务已完成，但无文本结果</p>
                </div>
              )}
            </div>
          )}

          {/* Quick actions */}
          <div className="flex items-center gap-3 pt-2">
            <a href="/agent" className="text-xs text-accent hover:underline flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              继续对话
            </a>
            <span className="text-content-tertiary text-xs">·</span>
            <a href="/tasks" className="text-xs text-content-secondary hover:text-accent hover:underline flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
              </svg>
              所有任务
            </a>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-flow-in">
          <div className={`px-4 py-2 rounded-lg text-white text-sm shadow-lg ${toast.ok ? 'bg-green-600/90' : 'bg-red-600/90'}`}>
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

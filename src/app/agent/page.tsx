'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AgentInput } from '@/components/agent/AgentInput';
import { TaskCanvas } from '@/components/agent/TaskCanvas';
import { TaskList } from '@/components/agent/TaskList';
import { Spinner } from '@/components/ui/Spinner';
import { useSSE } from '@/hooks/useSSE';
import { TaskStatus, TaskType, TaskSource } from '@/types/task';
import { Interaction, ApprovalType } from '@/types/interaction';

interface TaskEvent {
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}

interface TaskState {
  id: string;
  type: TaskType;
  status: TaskStatus;
  title: string;
  input: string;
  source: TaskSource;
  createdAt: string;
  updatedAt: string;
  events: TaskEvent[];
  eventsLoaded: boolean;
  currentInteraction: Interaction | null;
  result: Record<string, unknown> | null;
  lastSeenUpdatedAt: string;
  context: Record<string, unknown>;
}

function parseTaskFromAPI(data: Record<string, unknown>): TaskState {
  const events: TaskEvent[] = Array.isArray(data.events)
    ? (data.events as Record<string, unknown>[]).map((e) => ({
        type: e.type as string,
        data: (e.data as Record<string, unknown>) || {},
        createdAt: (e.createdAt as string) || new Date().toISOString(),
      }))
    : [];

  let currentInteraction: Interaction | null = null;
  if (data.status === 'interacting') {
    const lastIR = [...events].reverse().find((e) => e.type === 'interaction_request');
    if (lastIR) currentInteraction = lastIR.data as unknown as Interaction;
  }

  const now = new Date().toISOString();
  const updatedAt = (data.updatedAt as string) || now;

  return {
    id: data.id as string,
    type: (data.type as TaskType) || 'unknown',
    status: (data.status as TaskStatus) || 'pending',
    title: (data.title as string) || '',
    input: (data.input as string) || '',
    source: (data.source as TaskSource) || 'agent',
    createdAt: (data.createdAt as string) || now,
    updatedAt,
    events,
    eventsLoaded: true,
    currentInteraction,
    result: (data.result as Record<string, unknown>) || null,
    lastSeenUpdatedAt: updatedAt,
    context: (data.context as Record<string, unknown>) || {},
  };
}

function getTaskSummary(task: TaskState): string {
  const evts = task.events;
  for (let i = evts.length - 1; i >= 0; i--) {
    if (evts[i].type === 'interaction_request') return String(evts[i].data.question || '');
  }
  for (let i = evts.length - 1; i >= 0; i--) {
    if (evts[i].type === 'step_update') {
      const d = evts[i].data;
      const text = String(d.text || '');
      if (d.current && d.total) return `${text} (${d.current}/${d.total})`;
      return text;
    }
  }
  for (let i = evts.length - 1; i >= 0; i--) {
    if (evts[i].type === 'log') return String(evts[i].data.message || '');
  }
  return '';
}

const UNREAD_EVENT_TYPES = new Set(['interaction_request', 'task_completed', 'error', 'approval_requested']);

function hasImportantUpdate(task: TaskState): boolean {
  if (!task.lastSeenUpdatedAt) return true;
  for (let i = task.events.length - 1; i >= 0; i--) {
    const e = task.events[i];
    if (UNREAD_EVENT_TYPES.has(e.type) && e.createdAt > task.lastSeenUpdatedAt) return true;
    if (e.createdAt <= task.lastSeenUpdatedAt) break;
  }
  if (!task.eventsLoaded && task.updatedAt > task.lastSeenUpdatedAt) return true;
  return false;
}

const TERMINAL_STATUSES = new Set(['completed', 'failed']);

const WELCOME_EXAMPLES = [
  { label: '帮我写一封客户跟进邮件', type: 'email' },
  { label: '帮我做一份融资PPT结构', type: 'ppt' },
  { label: '帮我分析行业趋势', type: 'unknown' },
  { label: '帮我生成一个产品介绍视频', type: 'video' },
];

export default function AgentPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const match = document.cookie.match(/ob-user-id=([^;]+)/);
    if (!match || !match[1]) {
      router.replace('/login');
      return;
    }
    setAuthChecked(true);
  }, [router]);

  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingTaskId, setActionLoadingTaskId] = useState<string | null>(null);
  const [interactingTaskId, setInteractingTaskId] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [quota, setQuota] = useState<{
    credits: number; plan: string;
    limits: { maxConcurrent: number; allowedTypes: string[] };
  } | null>(null);
  const canvasEndRef = useRef<HTMLDivElement>(null);
  const activeTaskIdRef = useRef<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  activeTaskIdRef.current = activeTaskId;
  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;
  const hasTasks = tasks.length > 0;

  // SSE
  const { reconnecting: sseReconnecting } = useSSE(activeTaskId, {
    enabled: !!activeTaskId,
    onEvent: useCallback((event: TaskEvent) => {
      const currentId = activeTaskIdRef.current;
      if (!currentId) return;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== currentId) return t;
          const now = new Date().toISOString();
          const updated = { ...t, events: [...t.events, event], lastSeenUpdatedAt: now, updatedAt: now };
          if (event.type === 'status_change') updated.status = event.data.status as TaskStatus;
          if (event.type === 'interaction_request') {
            updated.currentInteraction = event.data as unknown as Interaction;
            updated.status = 'interacting';
          }
          if (event.type === 'artifact' && event.data.result) updated.result = event.data.result as Record<string, unknown>;
          if (event.type === 'task_completed' && event.data.result) {
            updated.result = event.data.result as Record<string, unknown>;
            updated.status = 'completed';
            fetchQuota();
          }
          return updated;
        })
      );
    }, []),
  });

  // Poll tasks
  useEffect(() => {
    function pollTasks() {
      fetch('/api/tasks')
        .then((r) => r.json())
        .then((data) => {
          if (!Array.isArray(data)) return;
          setTasks((prev) => {
            const prevMap = new Map(prev.map((t) => [t.id, t]));
            const merged: TaskState[] = [];
            const currentActiveId = activeTaskIdRef.current;
            for (const t of data as Record<string, unknown>[]) {
              const id = t.id as string;
              const serverUpdatedAt = (t.updatedAt as string) || '';
              const serverStatus = (t.status as TaskStatus) || 'pending';
              const existing = prevMap.get(id);
              if (existing) {
                const isActive = id === currentActiveId;
                if (isActive) {
                  merged.push({
                    ...existing,
                    title: (t.title as string) || existing.title,
                    type: (t.type as TaskType) || existing.type,
                    source: (t.source as TaskSource) || existing.source,
                    updatedAt: serverUpdatedAt > existing.updatedAt ? serverUpdatedAt : existing.updatedAt,
                    lastSeenUpdatedAt: serverUpdatedAt > existing.lastSeenUpdatedAt ? serverUpdatedAt : existing.lastSeenUpdatedAt,
                  });
                } else {
                  const shouldUpdateStatus = !TERMINAL_STATUSES.has(existing.status) || TERMINAL_STATUSES.has(serverStatus);
                  merged.push({
                    ...existing,
                    type: (t.type as TaskType) || existing.type,
                    status: shouldUpdateStatus ? serverStatus : existing.status,
                    title: (t.title as string) || existing.title,
                    source: (t.source as TaskSource) || existing.source,
                    updatedAt: serverUpdatedAt || existing.updatedAt,
                    result: (t.result as Record<string, unknown>) || existing.result,
                    lastSeenUpdatedAt: existing.lastSeenUpdatedAt,
                  });
                }
              } else {
                const now = new Date().toISOString();
                merged.push({
                  id, type: (t.type as TaskType) || 'unknown', status: serverStatus,
                  title: (t.title as string) || '', input: (t.input as string) || '',
                  source: (t.source as TaskSource) || 'agent',
                  createdAt: (t.createdAt as string) || now, updatedAt: serverUpdatedAt || now,
                  events: [], eventsLoaded: false, currentInteraction: null,
                  result: (t.result as Record<string, unknown>) || null, lastSeenUpdatedAt: '', context: {},
                });
              }
            }
            if (!currentActiveId && merged.length > 0) {
              const firstWaiting = merged.find((t) => t.status === 'interacting' || t.status === 'structuring');
              if (firstWaiting) setActiveTaskId(firstWaiting.id);
            }
            return merged;
          });
        })
        .catch(() => {});
    }
    pollTasks();
    const interval = setInterval(pollTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch events on task switch
  useEffect(() => {
    if (!activeTaskId) return;
    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task || task.eventsLoaded) return;
    fetch(`/api/tasks/${activeTaskId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data || data.error) return;
        const fullTask = parseTaskFromAPI(data);
        setTasks((prev) => prev.map((t) => (t.id !== activeTaskId ? t : fullTask)));
      })
      .catch(() => {});
  }, [activeTaskId, tasks]);

  // Clear unread
  useEffect(() => {
    if (!activeTaskId) return;
    setTasks((prev) =>
      prev.map((t) => t.id === activeTaskId ? { ...t, lastSeenUpdatedAt: t.updatedAt } : t)
    );
  }, [activeTaskId]);

  function showError(msg: string) {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 3000);
  }

  function fetchQuota() {
    fetch('/api/user').then((r) => r.json()).then((d) => {
      if (d.credits !== undefined) setQuota(d);
    }).catch(() => {});
  }

  useEffect(() => { fetchQuota(); }, []);

  // Auto scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) {
      canvasEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTask?.events.length]);

  // ---- Handlers ----

  async function handleSubmit(input: string, type?: string) {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, type: type || undefined, source: 'agent' }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error || '创建任务失败');
        return;
      }
      if (data.taskId) {
        const now = new Date().toISOString();
        const instantThinking: TaskEvent = {
          type: 'thinking',
          data: { text: '好，我来帮你处理这个任务，我先把整体思路理一下' },
          createdAt: now,
        };

        const detailRes = await fetch(`/api/tasks/${data.taskId}`);
        const detailData = await detailRes.json();
        let newTask: TaskState;
        if (detailData && !detailData.error) {
          newTask = parseTaskFromAPI(detailData);
          if (newTask.events.length === 0) {
            newTask.events = [instantThinking];
          }
        } else {
          newTask = {
            id: data.taskId, type: data.type || 'unknown', status: 'pending',
            title: input.slice(0, 50), input, source: 'agent',
            createdAt: now, updatedAt: now,
            events: [instantThinking], eventsLoaded: false,
            currentInteraction: null, result: null,
            lastSeenUpdatedAt: now, context: {},
          };
        }
        setTasks((prev) => [newTask, ...prev]);
        setActiveTaskId(data.taskId);
        fetchQuota();
      }
    } catch (error) { console.error('提交失败:', error); }
    finally { setIsSubmitting(false); }
  }

  async function handleInteractionSubmit(stepId: string, value: unknown) {
    if (!activeTaskId || interactingTaskId === activeTaskId) return;
    setInteractingTaskId(activeTaskId);
    setTasks((prev) => prev.map((t) => t.id === activeTaskId ? { ...t, currentInteraction: null } : t));
    try {
      const res = await fetch(`/api/tasks/${activeTaskId}/interact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionId: '', stepId, value }),
      });
      if (!res.ok) showError('提交失败，请重试');
    } catch { showError('网络错误，请重试'); }
    finally { setInteractingTaskId(null); }
  }

  async function handleApprove(approvalType: ApprovalType) {
    if (!activeTaskId || actionLoadingTaskId) return;
    setActionLoadingTaskId(activeTaskId);
    try {
      const res = await fetch(`/api/tasks/${activeTaskId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalType, action: 'approve' }),
      });
      if (!res.ok) showError('确认失败，请重试');
    } catch { showError('网络错误，请重试'); }
    finally { setActionLoadingTaskId(null); }
  }

  async function handleReject(approvalType: ApprovalType) {
    if (!activeTaskId || actionLoadingTaskId) return;
    setActionLoadingTaskId(activeTaskId);
    setTasks((prev) => prev.map((t) => t.id === activeTaskId ? { ...t, currentInteraction: null } : t));
    try {
      const res = await fetch(`/api/tasks/${activeTaskId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalType, action: 'reject' }),
      });
      if (!res.ok) showError('操作失败，请重试');
    } catch { showError('网络错误，请重试'); }
    finally { setActionLoadingTaskId(null); }
  }

  async function handleAdjustStructure() {
    if (!activeTaskId || interactingTaskId === activeTaskId) return;
    setInteractingTaskId(activeTaskId);
    setTasks((prev) => prev.map((t) => t.id === activeTaskId ? { ...t, currentInteraction: null } : t));
    try {
      await fetch(`/api/tasks/${activeTaskId}/interact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionId: '', stepId: 'request_adjust_structure', value: '' }),
      });
    } catch { showError('操作失败'); }
    finally { setInteractingTaskId(null); }
  }

  async function handleAdjustProposal() {
    if (!activeTaskId || interactingTaskId === activeTaskId) return;
    setInteractingTaskId(activeTaskId);
    setTasks((prev) => prev.map((t) => t.id === activeTaskId ? { ...t, currentInteraction: null } : t));
    try {
      await fetch(`/api/tasks/${activeTaskId}/interact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionId: '', stepId: 'request_adjust_proposal_structure', value: '' }),
      });
    } catch { showError('操作失败'); }
    finally { setInteractingTaskId(null); }
  }

  async function handleReviseEmail() {
    if (!activeTaskId || interactingTaskId === activeTaskId) return;
    setInteractingTaskId(activeTaskId);
    setTasks((prev) => prev.map((t) => t.id === activeTaskId ? { ...t, currentInteraction: null } : t));
    try {
      await fetch(`/api/tasks/${activeTaskId}/interact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionId: '', stepId: 'revise_email_request', value: '' }),
      });
    } catch { showError('操作失败'); }
    finally { setInteractingTaskId(null); }
  }

  function handleTaskSelect(id: string) {
    setActiveTaskId(id);
    setSidebarOpen(false);
  }

  const taskListItems = tasks.map((t) => ({
    id: t.id, type: t.type, status: t.status, title: t.title,
    createdAt: t.createdAt, summary: getTaskSummary(t),
    hasUnread: hasImportantUpdate(t),
    source: t.source,
  }));

  const isActiveTaskLoading = activeTask && !activeTask.eventsLoaded;

  // ---- Render ----

  if (!authChecked) {
    return <div className="h-[100dvh] bg-surface-primary" />;
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-surface-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-6 h-12 border-b border-border/40 flex-shrink-0 bg-surface-primary">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-surface-tertiary text-content-tertiary"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex items-center gap-1">
            <span className="text-accent font-semibold text-sm">ORANGE</span>
            <span className="text-content-primary font-semibold text-sm">BENCH</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {quota ? (
            <div className="flex items-center gap-2 text-xs text-content-tertiary">
              <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-surface-tertiary text-[10px] uppercase font-medium">{quota.plan}</span>
              <span className={`px-1.5 py-0.5 rounded font-medium tabular-nums ${quota.credits < 20 ? 'bg-red-500/10 text-red-400' : 'bg-accent/10 text-accent'}`}>
                {quota.credits}
              </span>
              <a href="/billing" className="px-2 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-[11px] font-medium">
                充值
              </a>
            </div>
          ) : null}
        </div>
      </header>

      {/* SSE reconnect banner */}
      {sseReconnecting ? (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-center text-xs text-amber-400 flex-shrink-0">
          连接中断，正在重连...
        </div>
      ) : null}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop sidebar — always visible */}
        <aside className="hidden md:flex flex-col w-64 border-r border-border/30 flex-shrink-0 bg-surface-primary">
          <div className="px-3 py-2.5 border-b border-border/20">
            <button
              onClick={() => { setActiveTaskId(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-content-secondary hover:bg-surface-tertiary transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              新任务
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {hasTasks ? (
              <TaskList tasks={taskListItems} activeTaskId={activeTaskId} onSelect={handleTaskSelect} />
            ) : (
              <p className="text-xs text-content-tertiary text-center py-8">暂无任务</p>
            )}
          </div>
        </aside>

        {/* Mobile sidebar */}
        {sidebarOpen ? (
          <>
            <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
            <aside className="fixed left-0 top-12 bottom-0 w-72 bg-surface-primary border-r border-border/30 z-50 md:hidden flex flex-col">
              <div className="px-3 py-2.5 border-b border-border/20">
                <button
                  onClick={() => { setActiveTaskId(null); setSidebarOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-content-secondary hover:bg-surface-tertiary transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  新任务
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {hasTasks ? (
                  <TaskList tasks={taskListItems} activeTaskId={activeTaskId} onSelect={handleTaskSelect} />
                ) : (
                  <p className="text-xs text-content-tertiary text-center py-8">暂无任务</p>
                )}
              </div>
            </aside>
          </>
        ) : null}

        {/* Main area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTask ? (
            <>
              {/* Task canvas */}
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar" key={activeTask.id}>
                <div className="max-w-3xl mx-auto pb-4 px-3 md:px-0">
                  <TaskCanvas
                    taskId={activeTask.id} title={activeTask.title} type={activeTask.type}
                    status={activeTask.status} input={activeTask.input} events={activeTask.events}
                    currentInteraction={activeTask.currentInteraction}
                    onInteractionSubmit={handleInteractionSubmit}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onAdjustStructure={handleAdjustStructure}
                    onAdjustProposal={handleAdjustProposal}
                    onReviseEmail={handleReviseEmail}
                    actionLoading={actionLoadingTaskId === activeTask.id}
                    result={activeTask.result}
                    loading={!!isActiveTaskLoading}
                    credits={quota?.credits ?? null}
                    executionStrategy={(activeTask.context.executionStrategy as string) || undefined}
                    modelName={(activeTask.context.model as string) || undefined}
                    onNewTask={handleSubmit}
                  />
                  <div ref={canvasEndRef} />
                </div>
              </div>

              {/* Fixed input bar */}
              <div className="border-t border-border/30 px-3 md:px-4 py-2.5 bg-surface-primary flex-shrink-0 pb-safe">
                <AgentInput
                  onSubmit={(input) => handleSubmit(input)}
                  disabled={isSubmitting}
                  placeholder="继续说，我帮你接着做..."
                />
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2 mt-2 text-content-tertiary text-xs">
                    <Spinner size="sm" /><span>正在处理...</span>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            /* Welcome — centered with input + examples */
            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex items-center justify-center px-4">
                <div className="w-full max-w-2xl space-y-8">
                  <div className="text-center space-y-2">
                    <h1 className="text-2xl md:text-3xl font-semibold text-content-primary">
                      我可以帮你自动完成工作
                    </h1>
                    <p className="text-content-tertiary text-sm">
                      输入任务，或点击下方示例开始
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {WELCOME_EXAMPLES.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => handleSubmit(ex.label, ex.type)}
                        disabled={isSubmitting}
                        className="text-left px-4 py-3 rounded-xl border border-border/40 hover:bg-surface-tertiary hover:border-accent/20 text-[13px] text-content-secondary transition-all disabled:opacity-50"
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Input pinned at bottom even in welcome */}
              <div className="border-t border-border/30 px-3 md:px-4 py-2.5 bg-surface-primary flex-shrink-0 pb-safe">
                <AgentInput
                  onSubmit={(input) => handleSubmit(input)}
                  disabled={isSubmitting}
                  placeholder="输入你想让我帮你做的事..."
                  prominent
                />
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2 mt-2 text-content-tertiary text-xs">
                    <Spinner size="sm" /><span>正在处理...</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Error toast */}
      {errorToast ? (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-flow-in">
          <div className="px-4 py-2 rounded-lg bg-red-500/90 text-white text-sm shadow-lg">
            {errorToast}
          </div>
        </div>
      ) : null}
    </div>
  );
}

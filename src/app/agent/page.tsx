'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { AgentInput } from '@/components/agent/AgentInput';
import { WorkCardList } from '@/components/agent/WorkCardList';
import { TaskCanvas } from '@/components/agent/TaskCanvas';
import { TaskList } from '@/components/agent/TaskList';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
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
  // Priority: interaction_request > step_update > log
  // Scan from end for each type separately to avoid interleaving noise
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

// Only important events count for unread — not logs/step_updates/thinking
const UNREAD_EVENT_TYPES = new Set(['interaction_request', 'task_completed', 'error', 'approval_requested']);

function hasImportantUpdate(task: TaskState): boolean {
  // If never seen, it's unread
  if (!task.lastSeenUpdatedAt) return true;
  // Check if any important event happened after lastSeen
  for (let i = task.events.length - 1; i >= 0; i--) {
    const e = task.events[i];
    if (UNREAD_EVENT_TYPES.has(e.type) && e.createdAt > task.lastSeenUpdatedAt) return true;
    // Stop scanning once we pass lastSeen
    if (e.createdAt <= task.lastSeenUpdatedAt) break;
  }
  // For tasks without loaded events, use updatedAt comparison
  if (!task.eventsLoaded && task.updatedAt > task.lastSeenUpdatedAt) return true;
  return false;
}

const TERMINAL_STATUSES = new Set(['completed', 'failed']);

export default function AgentPage() {
  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingTaskId, setActionLoadingTaskId] = useState<string | null>(null);
  const [interactingTaskId, setInteractingTaskId] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [quota, setQuota] = useState<{
    credits: number; plan: string;
    limits: { maxConcurrent: number; allowedTypes: string[] };
  } | null>(null);
  const canvasEndRef = useRef<HTMLDivElement>(null);
  const activeTaskIdRef = useRef<string | null>(null);

  activeTaskIdRef.current = activeTaskId;
  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;

  // SSE for active task
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
          }
          return updated;
        })
      );
    }, []),
  });

  // 5s task list polling — protected merge
  useEffect(() => {
    function pollTasks() {
      fetch('/api/tasks')
        .then((r) => r.json())
        .then((data) => {
          if (!Array.isArray(data)) return;
          if (data.length > 0) setShowWelcome(false);
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
                // PROTECT: never let poll regress active task or overwrite SSE-driven fields
                if (isActive) {
                  // Only update title (which may come from routing) and updatedAt
                  merged.push({
                    ...existing,
                    title: (t.title as string) || existing.title,
                    type: (t.type as TaskType) || existing.type,
                    source: (t.source as TaskSource) || existing.source,
                    updatedAt: serverUpdatedAt > existing.updatedAt ? serverUpdatedAt : existing.updatedAt,
                    lastSeenUpdatedAt: serverUpdatedAt > existing.lastSeenUpdatedAt ? serverUpdatedAt : existing.lastSeenUpdatedAt,
                  });
                } else {
                  // Non-active: update summary fields but never regress status
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

  // Auto-create first task for new users
  const firstTaskTriggered = useRef(false);
  useEffect(() => {
    if (firstTaskTriggered.current) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('ob_first_task_done')) return;

    // Wait for initial poll to determine if user has tasks
    const timer = setTimeout(() => {
      if (tasks.length === 0 && !firstTaskTriggered.current) {
        firstTaskTriggered.current = true;
        localStorage.setItem('ob_first_task_done', '1');
        handleSubmit('帮我生成一份今日工作总结邮件', 'email');
      }
    }, 2000); // 2s delay to let initial poll complete

    return () => clearTimeout(timer);
  }, [tasks.length]);

  // Fetch full events on task switch
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

  // Auto scroll — handled in render section via scrollContainerRef

  function showError(msg: string) {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 3000);
  }

  function fetchQuota() {
    fetch('/api/user').then((r) => r.json()).then((d) => {
      if (d.credits !== undefined) setQuota(d);
    }).catch(() => {});
  }

  async function handleAddCredits() {
    try {
      const res = await fetch('/api/billing/add-credits', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (data.success) {
        fetchQuota();
        showError('充值成功 +100 额度');
      }
    } catch { showError('充值失败'); }
  }

  useEffect(() => { fetchQuota(); }, []);

  // ---- Handlers ----

  async function handleSubmit(input: string, type?: string) {
    setIsSubmitting(true);
    setShowWelcome(false);
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

        // Instant feedback: inject a synthetic thinking event so canvas is never blank
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
          // Prepend instant thinking if no events yet
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
        fetchQuota(); // Refresh quota after task creation
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

  function handleCardSelect(prompt: string, type: string) { handleSubmit(prompt, type); }

  const hasTasks = tasks.length > 0;
  const isActiveTaskLoading = activeTask && !activeTask.eventsLoaded;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleTaskSelect(id: string) {
    setActiveTaskId(id);
    setSidebarOpen(false); // Close mobile sidebar on select
  }

  const taskListItems = tasks.map((t) => ({
    id: t.id, type: t.type, status: t.status, title: t.title,
    createdAt: t.createdAt, summary: getTaskSummary(t),
    hasUnread: hasImportantUpdate(t),
    source: t.source,
  }));

  // Smart auto-scroll: only if user is near bottom
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) {
      canvasEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTask?.events.length]);

  // ---- Render ----

  return (
    <div className="h-[100dvh] flex flex-col bg-surface-primary">
      {/* Header — minimal, not system-like */}
      <header className="flex items-center justify-between px-4 md:px-6 h-11 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          {hasTasks ? (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-surface-tertiary text-content-tertiary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          ) : null}
          <div className="flex items-center gap-1">
            <span className="text-accent font-semibold text-sm">ORANGE</span>
            <span className="text-content-primary font-semibold text-sm">BENCH</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {quota ? (
            <div className="hidden sm:flex items-center gap-2 text-xs text-content-tertiary">
              <span className="px-1 py-0.5 rounded bg-surface-tertiary text-content-tertiary text-[10px] uppercase">{quota.plan}</span>
              <span className={`px-1.5 py-0.5 rounded font-medium ${quota.credits < 20 ? 'bg-red-500/10 text-red-400' : 'bg-accent/10 text-accent'}`}>
                {quota.credits}
              </span>
              <span>额度</span>
              {quota.credits < 20 ? (
                <span className="text-red-400 text-[10px]">余额不足</span>
              ) : null}
              <button onClick={handleAddCredits} className="px-2 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium">
                充值
              </button>
            </div>
          ) : null}
          <ThemeToggle />
        </div>
      </header>

      {/* Connection indicator */}
      {sseReconnecting ? (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-center text-xs text-amber-400 flex-shrink-0">
          连接中断，正在重连...
        </div>
      ) : null}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop sidebar — softer, like history panel */}
        {hasTasks ? (
          <aside className="hidden md:block w-64 border-r border-border/40 p-2 overflow-y-auto custom-scrollbar flex-shrink-0 bg-surface-primary">
            <TaskList tasks={taskListItems} activeTaskId={activeTaskId} onSelect={handleTaskSelect} />
          </aside>
        ) : null}

        {/* Mobile sidebar */}
        {sidebarOpen && hasTasks ? (
          <>
            <div className="mobile-sidebar-overlay md:hidden" onClick={() => setSidebarOpen(false)} />
            <aside className="mobile-sidebar md:hidden p-2 custom-scrollbar">
              <TaskList tasks={taskListItems} activeTaskId={activeTaskId} onSelect={handleTaskSelect} />
            </aside>
          </>
        ) : null}

        {/* Main area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTask ? (
            <>
              {/* Task execution area — with transition */}
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar animate-flow-in" key={activeTask.id}>
                <div className="max-w-3xl mx-auto pb-4 px-2 md:px-0">
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

              {/* Input — bottom bar */}
              <div className="border-t border-border/40 px-3 md:px-4 py-2.5 bg-surface-primary flex-shrink-0 pb-safe">
                <AgentInput
                  onSubmit={(input) => handleSubmit(input)}
                  disabled={isSubmitting}
                  placeholder="告诉我下一个任务..."
                />
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2 mt-2 text-content-tertiary text-sm">
                    <Spinner size="sm" /><span>正在处理...</span>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            /* Welcome — input centered like ChatGPT */
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <div className="w-full max-w-2xl space-y-8 md:space-y-10">
                <div className="text-center space-y-2 md:space-y-3">
                  <h1 className="text-2xl md:text-3xl font-semibold text-content-primary">
                    你好，有什么可以帮你完成的？
                  </h1>
                  <p className="text-content-secondary text-sm md:text-base">
                    描述你的任务，我来帮你执行
                  </p>
                </div>

                {/* Input in center */}
                <AgentInput
                  onSubmit={(input) => handleSubmit(input)}
                  disabled={isSubmitting}
                  placeholder="描述你的任务，我来帮你执行"
                  prominent
                />

                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2 text-content-tertiary text-sm">
                    <Spinner size="sm" /><span>正在处理...</span>
                  </div>
                ) : null}

                {/* Work cards below input */}
                {showWelcome ? (
                  <WorkCardList onSelect={handleCardSelect} />
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

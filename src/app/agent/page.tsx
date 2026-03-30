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
  };
}

function getTaskSummary(task: TaskState): string {
  const evts = task.events;
  for (let i = evts.length - 1; i >= 0; i--) {
    const e = evts[i];
    if (e.type === 'interaction_request') return String(e.data.question || '');
    if (e.type === 'log') return String(e.data.message || '');
    if (e.type === 'step_update') return String(e.data.text || '');
  }
  return '';
}

// Status priority for determining if polling should NOT overwrite
const TERMINAL_STATUSES = new Set(['completed', 'failed']);

export default function AgentPage() {
  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingTaskId, setActionLoadingTaskId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const canvasEndRef = useRef<HTMLDivElement>(null);
  const activeTaskIdRef = useRef<string | null>(null);

  activeTaskIdRef.current = activeTaskId;
  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;

  // SSE for active task
  useSSE(activeTaskId, {
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
                  result: (t.result as Record<string, unknown>) || null, lastSeenUpdatedAt: '',
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

  // Auto scroll
  useEffect(() => {
    canvasEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTask?.events.length]);

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
      if (data.taskId) {
        const detailRes = await fetch(`/api/tasks/${data.taskId}`);
        const detailData = await detailRes.json();
        let newTask: TaskState;
        if (detailData && !detailData.error) {
          newTask = parseTaskFromAPI(detailData);
        } else {
          const now = new Date().toISOString();
          newTask = {
            id: data.taskId, type: data.type || 'unknown', status: 'pending',
            title: input.slice(0, 50), input, source: 'agent',
            createdAt: now, updatedAt: now,
            events: [], eventsLoaded: false, currentInteraction: null, result: null,
            lastSeenUpdatedAt: now,
          };
        }
        setTasks((prev) => [newTask, ...prev]);
        setActiveTaskId(data.taskId);
      }
    } catch (error) { console.error('提交失败:', error); }
    finally { setIsSubmitting(false); }
  }

  async function handleInteractionSubmit(stepId: string, value: unknown) {
    if (!activeTaskId) return;
    setTasks((prev) => prev.map((t) => t.id === activeTaskId ? { ...t, currentInteraction: null } : t));
    try {
      await fetch(`/api/tasks/${activeTaskId}/interact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionId: '', stepId, value }),
      });
    } catch (error) { console.error('交互提交失败:', error); }
  }

  async function handleApprove(approvalType: ApprovalType) {
    if (!activeTaskId) return;
    setActionLoadingTaskId(activeTaskId);
    try {
      const res = await fetch(`/api/tasks/${activeTaskId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalType, action: 'approve' }),
      });
      if (!res.ok) console.error('确认失败:', await res.text());
    } catch (error) { console.error('确认失败:', error); }
    finally { setActionLoadingTaskId(null); }
  }

  async function handleReject(approvalType: ApprovalType) {
    if (!activeTaskId) return;
    setTasks((prev) => prev.map((t) => t.id === activeTaskId ? { ...t, currentInteraction: null } : t));
    try {
      await fetch(`/api/tasks/${activeTaskId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalType, action: 'reject' }),
      });
    } catch (error) { console.error('操作失败:', error); }
  }

  async function handleAdjustStructure() {
    if (!activeTaskId) return;
    setTasks((prev) => prev.map((t) => t.id === activeTaskId ? { ...t, currentInteraction: null } : t));
    try {
      await fetch(`/api/tasks/${activeTaskId}/interact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionId: '', stepId: 'request_adjust_structure', value: '' }),
      });
    } catch (error) { console.error('调整结构失败:', error); }
  }

  async function handleAdjustProposal() {
    if (!activeTaskId) return;
    setTasks((prev) => prev.map((t) => t.id === activeTaskId ? { ...t, currentInteraction: null } : t));
    try {
      await fetch(`/api/tasks/${activeTaskId}/interact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionId: '', stepId: 'request_adjust_proposal_structure', value: '' }),
      });
    } catch (error) { console.error('调整方案结构失败:', error); }
  }

  async function handleReviseEmail() {
    if (!activeTaskId) return;
    setTasks((prev) => prev.map((t) => t.id === activeTaskId ? { ...t, currentInteraction: null } : t));
    try {
      await fetch(`/api/tasks/${activeTaskId}/interact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionId: '', stepId: 'revise_email_request', value: '' }),
      });
    } catch (error) { console.error('修改邮件失败:', error); }
  }

  function handleCardSelect(prompt: string, type: string) { handleSubmit(prompt, type); }

  const hasTasks = tasks.length > 0;
  const isActiveTaskLoading = activeTask && !activeTask.eventsLoaded;

  // ---- Render ----

  return (
    <div className="h-screen flex flex-col bg-surface-primary">
      <header className="flex items-center justify-between px-6 h-12 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-accent font-bold text-base tracking-tight">ORANGE</span>
          <span className="text-content-primary font-bold text-base tracking-tight">BENCH</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex-1 flex overflow-hidden">
        {hasTasks ? (
          <aside className="w-72 border-r border-border p-2.5 overflow-y-auto custom-scrollbar flex-shrink-0">
            <TaskList
              tasks={tasks.map((t) => ({
                id: t.id, type: t.type, status: t.status, title: t.title,
                createdAt: t.createdAt, summary: getTaskSummary(t),
                hasUnread: t.updatedAt > t.lastSeenUpdatedAt,
                source: t.source,
              }))}
              activeTaskId={activeTaskId}
              onSelect={setActiveTaskId}
            />
          </aside>
        ) : null}

        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTask ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="max-w-3xl mx-auto pb-4">
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
                />
                <div ref={canvasEndRef} />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-8 max-w-2xl px-6">
                {showWelcome ? (
                  <>
                    <div className="space-y-3">
                      <h1 className="text-3xl font-semibold text-content-primary">
                        你好，有什么可以帮你完成的？
                      </h1>
                      <p className="text-content-secondary text-base">
                        直接描述你的工作需求，或选择下方的快捷入口开始
                      </p>
                    </div>
                    <WorkCardList onSelect={handleCardSelect} />
                  </>
                ) : null}
              </div>
            </div>
          )}

          <div className="border-t border-border px-4 py-3 bg-surface-primary flex-shrink-0">
            {!activeTask && !showWelcome ? (
              <div className="max-w-3xl mx-auto mb-3">
                <WorkCardList onSelect={handleCardSelect} />
              </div>
            ) : null}
            <AgentInput
              onSubmit={(input) => handleSubmit(input)}
              disabled={isSubmitting}
              placeholder={activeTask ? '输入新的工作需求...' : '描述你想完成的工作...'}
            />
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2 mt-2 text-content-tertiary text-sm">
                <Spinner size="sm" /><span>正在处理...</span>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { AgentInput } from '@/components/agent/AgentInput';
import { WorkCardList } from '@/components/agent/WorkCardList';
import { TaskCanvas } from '@/components/agent/TaskCanvas';
import { TaskList } from '@/components/agent/TaskList';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Spinner } from '@/components/ui/Spinner';
import { useSSE } from '@/hooks/useSSE';
import { TaskStatus, TaskType } from '@/types/task';
import { Interaction } from '@/types/interaction';

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
  createdAt: string;
  events: TaskEvent[];
  eventsLoaded: boolean;
  currentInteraction: Interaction | null;
  result: Record<string, unknown> | null;
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
    if (lastIR) {
      currentInteraction = lastIR.data as unknown as Interaction;
    }
  }

  return {
    id: data.id as string,
    type: (data.type as TaskType) || 'unknown',
    status: (data.status as TaskStatus) || 'pending',
    title: (data.title as string) || '',
    input: (data.input as string) || '',
    createdAt: (data.createdAt as string) || new Date().toISOString(),
    events,
    eventsLoaded: true,
    currentInteraction,
    result: (data.result as Record<string, unknown>) || null,
  };
}

export default function AgentPage() {
  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const canvasEndRef = useRef<HTMLDivElement>(null);

  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;

  useSSE(activeTaskId, {
    enabled: !!activeTaskId,
    onEvent: useCallback(
      (event: TaskEvent) => {
        if (!activeTaskId) return;
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== activeTaskId) return t;
            const updated = { ...t, events: [...t.events, event] };
            if (event.type === 'status_change') {
              updated.status = event.data.status as TaskStatus;
            }
            if (event.type === 'interaction_request') {
              updated.currentInteraction = event.data as unknown as Interaction;
              updated.status = 'interacting';
            }
            if (event.type === 'artifact' && event.data.result) {
              updated.result = event.data.result as Record<string, unknown>;
            }
            if (event.type === 'task_completed' && event.data.result) {
              updated.result = event.data.result as Record<string, unknown>;
              updated.status = 'completed';
            }
            return updated;
          })
        );
      },
      [activeTaskId]
    ),
  });

  useEffect(() => {
    fetch('/api/tasks')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const loaded: TaskState[] = data.map((t: Record<string, unknown>) => ({
            id: t.id as string,
            type: (t.type as TaskType) || 'unknown',
            status: (t.status as TaskStatus) || 'pending',
            title: (t.title as string) || '',
            input: (t.input as string) || '',
            createdAt: (t.createdAt as string) || new Date().toISOString(),
            events: [],
            eventsLoaded: false,
            currentInteraction: null,
            result: (t.result as Record<string, unknown>) || null,
          }));
          setTasks(loaded);
          setShowWelcome(false);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeTaskId) return;
    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task || task.eventsLoaded) return;

    fetch(`/api/tasks/${activeTaskId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data || data.error) return;
        const fullTask = parseTaskFromAPI(data);
        setTasks((prev) =>
          prev.map((t) => (t.id !== activeTaskId ? t : fullTask))
        );
      })
      .catch(() => {});
  }, [activeTaskId, tasks]);

  useEffect(() => {
    canvasEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTask?.events.length]);

  async function handleSubmit(input: string, type?: string) {
    setIsSubmitting(true);
    setShowWelcome(false);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          newTask = {
            id: data.taskId,
            type: data.type || 'unknown',
            status: 'pending',
            title: input.slice(0, 50),
            input,
            createdAt: new Date().toISOString(),
            events: [],
            eventsLoaded: false,
            currentInteraction: null,
            result: null,
          };
        }

        setTasks((prev) => [newTask, ...prev]);
        setActiveTaskId(data.taskId);
      }
    } catch (error) {
      console.error('提交失败:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleInteractionSubmit(stepId: string, value: unknown) {
    if (!activeTaskId) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === activeTaskId ? { ...t, currentInteraction: null } : t
      )
    );
    try {
      await fetch(`/api/tasks/${activeTaskId}/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionId: '', stepId, value }),
      });
    } catch (error) {
      console.error('交互提交失败:', error);
    }
  }

  async function handleApproveStructure() {
    if (!activeTaskId) return;
    try {
      await fetch(`/api/tasks/${activeTaskId}/approve-structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('结构审批失败:', error);
    }
  }

  async function handleAdjustStructure() {
    if (!activeTaskId) return;
    try {
      await fetch(`/api/tasks/${activeTaskId}/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionId: '', stepId: 'request_adjust_structure', value: '' }),
      });
    } catch (error) {
      console.error('调整结构失败:', error);
    }
  }

  async function handleSendEmail() {
    if (!activeTaskId) return;
    // Clear interaction immediately for responsive UI
    setTasks((prev) =>
      prev.map((t) =>
        t.id === activeTaskId ? { ...t, currentInteraction: null } : t
      )
    );
    try {
      await fetch(`/api/tasks/${activeTaskId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('发送邮件失败:', error);
    }
  }

  function handleCardSelect(prompt: string, type: string) {
    handleSubmit(prompt, type);
  }

  const hasTasks = tasks.length > 0;

  return (
    <div className="h-screen flex flex-col bg-surface-primary">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-accent font-bold text-lg">ORANGE</span>
          <span className="text-content-primary font-bold text-lg">BENCH</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex-1 flex overflow-hidden">
        {hasTasks ? (
          <aside className="w-72 border-r border-border p-3 overflow-y-auto custom-scrollbar flex-shrink-0">
            <TaskList
              tasks={tasks.map((t) => ({
                id: t.id, type: t.type, status: t.status, title: t.title, createdAt: t.createdAt,
              }))}
              activeTaskId={activeTaskId}
              onSelect={setActiveTaskId}
            />
          </aside>
        ) : null}

        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTask ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="max-w-3xl mx-auto">
                <TaskCanvas
                  taskId={activeTask.id}
                  title={activeTask.title}
                  type={activeTask.type}
                  status={activeTask.status}
                  events={activeTask.events}
                  currentInteraction={activeTask.currentInteraction}
                  onInteractionSubmit={handleInteractionSubmit}
                  onApproveStructure={handleApproveStructure}
                  onAdjustStructure={handleAdjustStructure}
                  onSendEmail={handleSendEmail}
                  result={activeTask.result}
                />
                <div ref={canvasEndRef} />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-6 max-w-xl px-4">
                {showWelcome ? (
                  <>
                    <div className="space-y-2">
                      <h1 className="text-2xl font-semibold text-content-primary">
                        你好，有什么可以帮你完成的？
                      </h1>
                      <p className="text-content-secondary text-sm">
                        直接描述你的工作需求，或选择下方的快捷卡片开始
                      </p>
                    </div>
                    <WorkCardList onSelect={handleCardSelect} />
                  </>
                ) : null}
              </div>
            </div>
          )}

          <div className="border-t border-border p-4 bg-surface-primary">
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
                <Spinner size="sm" />
                <span>正在处理...</span>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

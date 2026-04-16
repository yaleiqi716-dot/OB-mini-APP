// Part of OrangeBench product internal design system
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSSE } from "@/hooks/useSSE";
import { buildThinkingStream } from "@/lib/humanize";
import { UserMessage } from "./UserMessage";
import { AgentResponse } from "./AgentResponse";

interface TaskState {
  id: string;
  status: string;
  type: string;
  input: string;
  result: Record<string, unknown> | null;
  events: Array<{ type: string; data: Record<string, unknown>; createdAt: string }>;
  createdAt: string;
}

const TERMINAL = new Set(["completed", "failed"]);

export function MessageList({ conversationId }: { conversationId: string }) {
  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  // Fetch tasks for this conversation
  useEffect(() => {
    setLoading(true);
    fetch(`/api/conversations/${conversationId}/tasks`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (Array.isArray(data)) {
          setTasks(data.map(parseTask));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conversationId]);

  // Find active (non-terminal) task for SSE
  const activeTask = tasks.findLast((t) => !TERMINAL.has(t.status));
  const activeTaskId = activeTask?.id ?? null;

  // SSE for active task
  useSSE(activeTaskId, {
    enabled: !!activeTaskId,
    onEvent: useCallback((event: { type: string; data: Record<string, unknown>; createdAt: string }) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== activeTaskId) return t;
          const updated = { ...t, events: [...t.events, event] };
          if (event.type === "status_change") updated.status = event.data.status as string;
          if (event.type === "task_completed" && event.data.result) {
            updated.result = event.data.result as Record<string, unknown>;
            updated.status = "completed";
          }
          if (event.type === "artifact" && event.data.result) {
            updated.result = event.data.result as Record<string, unknown>;
          }
          return updated;
        })
      );
    }, [activeTaskId]),
  });

  // 2s polling fallback for active task
  useEffect(() => {
    if (!activeTaskId) return;
    const iv = setInterval(() => {
      fetch(`/api/tasks/${activeTaskId}`)
        .then((r) => r.json())
        .then((d) => {
          if (!d || d.error) return;
          setTasks((prev) =>
            prev.map((t) => (t.id === activeTaskId ? parseTask(d) : t))
          );
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(iv);
  }, [activeTaskId]);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  });

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-text-muted animate-pulse">加载中...</span>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-text-muted">暂无消息</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto product-scrollbar px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {tasks.map((task) => {
          const thinking = buildThinkingStream(task.events);
          const errEvent = task.events.find((e) => e.type === "error");
          const errMsg = errEvent ? String(errEvent.data.message || "") : undefined;

          return (
            <div key={task.id} className="space-y-6">
              <UserMessage
                content={task.input}
                time={new Date(task.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
              />
              <AgentResponse
                status={task.status}
                thinkingText={thinking}
                result={task.result}
                resultType={task.type}
                error={errMsg}
              />
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function parseTask(d: Record<string, unknown>): TaskState {
  const events = Array.isArray(d.events)
    ? (d.events as Record<string, unknown>[]).map((e) => ({
        type: e.type as string,
        data: (e.data as Record<string, unknown>) || {},
        createdAt: (e.createdAt as string) || new Date().toISOString(),
      }))
    : [];
  let result = d.result as Record<string, unknown> | null;
  if (typeof result === "string") {
    try { result = JSON.parse(result); } catch { result = { text: result }; }
  }
  return {
    id: d.id as string,
    status: (d.status as string) || "pending",
    type: (d.type as string) || "unknown",
    input: (d.input as string) || "",
    result,
    events,
    createdAt: (d.createdAt as string) || new Date().toISOString(),
  };
}

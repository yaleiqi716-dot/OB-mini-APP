'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { AgentInput } from '@/components/agent/AgentInput';
import { Spinner } from '@/components/ui/Spinner';

interface TaskDetail {
  id: string;
  title: string;
  input: string;
  status: string;   // 唯一真实状态源
  assigneeId: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  queued: '正在处理',
  running: 'AI执行中',
  interacting: 'AI执行中',
  completed: '已完成',
  failed: '执行失败',
};

const STATUS_COLOR: Record<string, string> = {
  queued: 'bg-amber-500/10 text-amber-400',
  running: 'bg-blue-500/10 text-blue-400',
  interacting: 'bg-blue-500/10 text-blue-400',
  completed: 'bg-green-500/10 text-green-400',
  failed: 'bg-red-500/10 text-red-400',
};

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.taskId as string;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agentResult, setAgentResult] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTask() {
      try {
        const res = await fetch(`/api/tasks/${taskId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || '获取任务失败');
          return;
        }
        setTask({
          id: data.id,
          title: data.title,
          input: data.input,
          status: data.status || 'queued',
          assigneeId: data.assigneeId,
        });
      } catch {
        setError('网络错误');
      } finally {
        setLoading(false);
      }
    }
    fetchTask();
  }, [taskId]);

  const handleAgentSubmit = useCallback(async (input: string) => {
    setSubmitting(true);
    setAgentResult(null);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, source: 'agent', parentTaskId: taskId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error || '执行失败';
        if (res.status === 403 && errMsg.includes('额度')) {
          setAgentResult(`CREDITS_ERROR:${errMsg}`);
        } else {
          setAgentResult(`错误：${errMsg}`);
        }
        return;
      }
      setAgentResult(`任务已创建（ID: ${data.taskId}），正在执行中...`);
    } catch {
      setAgentResult('网络错误，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [taskId]);

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-surface-primary">
        <Spinner size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-surface-primary">
        <div className="text-center space-y-3">
          <div className="text-red-400 text-lg font-medium">{error}</div>
          <a href="/tasks" className="text-accent text-sm hover:underline">返回任务列表</a>
        </div>
      </div>
    );
  }

  if (!task) return null;

  return (
    <div className="h-[100dvh] flex flex-col bg-surface-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-6 h-11 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <a href="/tasks" className="text-content-tertiary hover:text-content-primary transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </a>
          <div className="flex items-center gap-1">
            <span className="text-accent font-semibold text-sm">ORANGE</span>
            <span className="text-content-primary font-semibold text-sm">BENCH</span>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[task.status] || 'bg-surface-tertiary text-content-tertiary'}`}>
          {STATUS_LABEL[task.status] || task.status}
        </span>
      </header>

      {/* Task content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-4 md:px-0 py-6 space-y-6">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-content-primary">
              {task.title || '未命名任务'}
            </h1>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-content-tertiary uppercase tracking-wide">任务要求</div>
            <div className="rounded-xl bg-surface-secondary border border-border/50 p-4">
              <p className="text-content-primary text-sm leading-relaxed whitespace-pre-wrap">{task.input}</p>
            </div>
          </div>

          {agentResult && agentResult.startsWith('CREDITS_ERROR:') ? (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 space-y-3">
              <p className="text-sm text-amber-400">{agentResult.replace('CREDITS_ERROR:', '')}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <a href="/billing" className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors">
                  充值 ¥19（100 credits）
                </a>
              </div>
            </div>
          ) : agentResult ? (
            <div className="rounded-xl bg-surface-secondary border border-border/50 p-4">
              <div className="text-xs font-medium text-content-tertiary mb-2">AI 执行结果</div>
              <p className="text-content-primary text-sm">{agentResult}</p>
            </div>
          ) : null}

          {task.status === 'completed' && (
            <div className="flex justify-end">
              <span className="px-4 py-2 rounded-xl bg-green-500/10 text-green-400 text-sm font-medium">
                已完成
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Agent input at bottom */}
      <div className="border-t border-border/40 px-3 md:px-4 py-2.5 bg-surface-primary flex-shrink-0 pb-safe">
        <AgentInput
          onSubmit={handleAgentSubmit}
          disabled={submitting}
          placeholder="输入指令，让AI帮你完成这个任务..."
        />
        {submitting ? (
          <div className="flex items-center justify-center gap-2 mt-2 text-content-tertiary text-sm">
            <Spinner size="sm" /><span>正在处理...</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

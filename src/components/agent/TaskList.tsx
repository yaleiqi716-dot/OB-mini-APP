'use client';

import { Badge } from '@/components/ui/Badge';
import { TaskStatus, TaskType, TaskSource } from '@/types/task';
import { TASK_TYPES } from '@/lib/constants';
import { cn, formatTime } from '@/lib/utils';

interface TaskItem {
  id: string;
  type: TaskType;
  status: TaskStatus;
  title: string;
  createdAt: string;
  summary: string;
  hasUnread: boolean;
  source: TaskSource;
}

interface TaskListProps {
  tasks: TaskItem[];
  activeTaskId: string | null;
  onSelect: (taskId: string) => void;
}

const STATUS_PRIORITY: Record<TaskStatus, number> = {
  interacting: 0,
  structuring: 1,
  executing: 2,
  understanding: 3,
  queued: 4,
  pending: 5,
  completed: 6,
  failed: 7,
};

const SOURCE_LABELS: Record<TaskSource, string> = {
  agent: '',
  zapier: '外部',
  api: '接口',
};

export function TaskList({ tasks, activeTaskId, onSelect }: TaskListProps) {
  if (tasks.length === 0) return null;

  const sorted = [...tasks].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 9;
    const pb = STATUS_PRIORITY[b.status] ?? 9;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const waiting = sorted.filter((t) => t.status === 'interacting' || t.status === 'structuring');
  const active = sorted.filter((t) => t.status === 'executing' || t.status === 'understanding' || t.status === 'pending' || t.status === 'queued');
  const done = sorted.filter((t) => t.status === 'completed' || t.status === 'failed');

  return (
    <div className="space-y-4">
      {waiting.length > 0 ? (
        <Section title="等待处理" count={waiting.length}>
          {waiting.map((t) => (
            <TaskRow key={t.id} task={t} active={activeTaskId === t.id} onSelect={onSelect} />
          ))}
        </Section>
      ) : null}

      {active.length > 0 ? (
        <Section title="进行中">
          {active.map((t) => (
            <TaskRow key={t.id} task={t} active={activeTaskId === t.id} onSelect={onSelect} />
          ))}
        </Section>
      ) : null}

      {done.length > 0 ? (
        <Section title="已结束">
          {done.map((t) => (
            <TaskRow key={t.id} task={t} active={activeTaskId === t.id} onSelect={onSelect} />
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 px-2 mb-1.5">
        <p className="text-[11px] font-medium text-content-tertiary uppercase tracking-wider">{title}</p>
        {count ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">{count}</span>
        ) : null}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function TaskRow({ task, active, onSelect }: { task: TaskItem; active: boolean; onSelect: (id: string) => void }) {
  const typeInfo = TASK_TYPES.find((t) => t.value === task.type);
  const isWaiting = task.status === 'interacting' || task.status === 'structuring';
  const sourceLabel = SOURCE_LABELS[task.source];

  return (
    <button
      onClick={() => onSelect(task.id)}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors',
        active
          ? 'bg-accent/8 border border-accent/15'
          : 'hover:bg-surface-tertiary/70 border border-transparent',
        isWaiting && !active && 'bg-amber-500/5'
      )}
    >
      <span className="text-sm flex-shrink-0">{typeInfo?.icon || '📎'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={cn('text-[13px] truncate flex-1', active ? 'text-content-primary font-medium' : 'text-content-primary')}>
            {task.title || '新任务'}
          </p>
          {task.hasUnread && !active ? (
            <span className="h-1.5 w-1.5 rounded-full bg-accent flex-shrink-0" />
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Badge status={task.status} />
          {sourceLabel ? (
            <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400">{sourceLabel}</span>
          ) : null}
          <span className="text-[11px] text-content-tertiary ml-auto">{formatTime(task.createdAt)}</span>
        </div>
        {task.summary ? (
          <p className="text-[11px] text-content-tertiary truncate mt-0.5 leading-tight">{task.summary}</p>
        ) : null}
      </div>
    </button>
  );
}

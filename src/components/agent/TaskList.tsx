'use client';

import { Badge } from '@/components/ui/Badge';
import { TaskStatus, TaskType } from '@/types/task';
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
  pending: 4,
  completed: 5,
  failed: 6,
};

export function TaskList({ tasks, activeTaskId, onSelect }: TaskListProps) {
  if (tasks.length === 0) return null;

  const sorted = [...tasks].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 9;
    const pb = STATUS_PRIORITY[b.status] ?? 9;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-1">
      <p className="text-xs text-content-tertiary px-2 mb-2">任务列表</p>
      {sorted.map((task) => {
        const typeInfo = TASK_TYPES.find((t) => t.value === task.type);
        const isWaiting = task.status === 'interacting' || task.status === 'structuring';

        return (
          <button
            key={task.id}
            onClick={() => onSelect(task.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
              activeTaskId === task.id
                ? 'bg-surface-tertiary border border-accent/20'
                : 'hover:bg-surface-tertiary border border-transparent',
              isWaiting && activeTaskId !== task.id && 'border-amber-500/20 bg-amber-500/5'
            )}
          >
            <span className="text-sm flex-shrink-0">{typeInfo?.icon || '📎'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-content-primary truncate flex-1">
                  {task.title || '新任务'}
                </p>
                {task.hasUnread && activeTaskId !== task.id ? (
                  <span className="h-2 w-2 rounded-full bg-accent flex-shrink-0" />
                ) : null}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge status={task.status} />
                <span className="text-xs text-content-tertiary">
                  {formatTime(task.createdAt)}
                </span>
              </div>
              {task.summary ? (
                <p className="text-xs text-content-tertiary truncate mt-0.5">
                  {task.summary}
                </p>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

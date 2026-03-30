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
}

interface TaskListProps {
  tasks: TaskItem[];
  activeTaskId: string | null;
  onSelect: (taskId: string) => void;
}

export function TaskList({ tasks, activeTaskId, onSelect }: TaskListProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs text-content-tertiary px-2 mb-2">任务列表</p>
      {tasks.map((task) => {
        const typeInfo = TASK_TYPES.find((t) => t.value === task.type);
        return (
          <button
            key={task.id}
            onClick={() => onSelect(task.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
              activeTaskId === task.id
                ? 'bg-surface-tertiary border border-accent/20'
                : 'hover:bg-surface-tertiary border border-transparent'
            )}
          >
            <span className="text-sm flex-shrink-0">{typeInfo?.icon || '📎'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-content-primary truncate">
                {task.title || '新任务'}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge status={task.status} />
                <span className="text-xs text-content-tertiary">
                  {formatTime(task.createdAt)}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

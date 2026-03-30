'use client';

import { cn } from '@/lib/utils';
import { TaskStatus } from '@/types/task';
import { TASK_STATUS_LABELS } from '@/lib/constants';

const statusColors: Record<TaskStatus, string> = {
  pending: 'bg-gray-500/20 text-gray-400',
  routing: 'bg-blue-500/20 text-blue-400',
  interacting: 'bg-amber-500/20 text-amber-400',
  executing: 'bg-accent/20 text-accent',
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
};

export function Badge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusColors[status] || 'bg-gray-500/20 text-gray-400'
      )}
    >
      {status === 'executing' && (
        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
      )}
      {TASK_STATUS_LABELS[status] || status}
    </span>
  );
}

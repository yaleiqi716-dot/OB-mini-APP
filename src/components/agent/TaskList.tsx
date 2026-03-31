'use client';

import { TaskStatus, TaskType, TaskSource } from '@/types/task';
import { cn } from '@/lib/utils';

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
  blocked: 0,
  interacting: 1,
  structuring: 2,
  executing: 3,
  understanding: 4,
  queued: 5,
  pending: 6,
  completed: 7,
  failed: 8,
};

function StatusDot({ status }: { status: TaskStatus }) {
  const isActive = ['executing', 'understanding', 'structuring', 'pending', 'queued'].includes(status);
  const isWaiting = ['interacting', 'blocked'].includes(status);
  const isFailed = status === 'failed';

  if (isActive) return <span className="sidebar-status-dot sidebar-status-dot--active" />;
  if (isWaiting) return <span className="sidebar-status-dot sidebar-status-dot--waiting" />;
  if (isFailed) return <span className="sidebar-status-dot sidebar-status-dot--failed" />;
  return null;
}

export function TaskList({ tasks, activeTaskId, onSelect }: TaskListProps) {
  if (tasks.length === 0) return null;

  const sorted = [...tasks].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 9;
    const pb = STATUS_PRIORITY[b.status] ?? 9;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const waiting = sorted.filter(
    (t) => t.status === 'interacting' || t.status === 'structuring' || t.status === 'blocked'
  );
  const active = sorted.filter(
    (t) =>
      t.status === 'executing' ||
      t.status === 'understanding' ||
      t.status === 'pending' ||
      t.status === 'queued'
  );
  const done = sorted.filter((t) => t.status === 'completed' || t.status === 'failed');

  return (
    <div className="sidebar-task-list">
      {waiting.length > 0 && (
        <Section title="等待处理">
          {waiting.map((t) => (
            <TaskRow key={t.id} task={t} active={activeTaskId === t.id} onSelect={onSelect} />
          ))}
        </Section>
      )}
      {active.length > 0 && (
        <Section title="进行中">
          {active.map((t) => (
            <TaskRow key={t.id} task={t} active={activeTaskId === t.id} onSelect={onSelect} />
          ))}
        </Section>
      )}
      {done.length > 0 && (
        <Section title="已结束">
          {done.map((t) => (
            <TaskRow key={t.id} task={t} active={activeTaskId === t.id} onSelect={onSelect} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sidebar-section">
      <p className="sidebar-section-title">{title}</p>
      <div>{children}</div>
    </div>
  );
}

function TaskRow({
  task,
  active,
  onSelect,
}: {
  task: TaskItem;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const isWaiting = task.status === 'interacting' || task.status === 'blocked';

  return (
    <button
      onClick={() => onSelect(task.id)}
      className={cn(
        'sidebar-task-row',
        active ? 'sidebar-task-row--active' : 'sidebar-task-row--idle',
        isWaiting && !active && 'sidebar-task-row--waiting'
      )}
    >
      <div className="sidebar-task-row-inner">
        <div className="sidebar-task-title-row">
          <span className={cn('sidebar-task-title', active && 'sidebar-task-title--active')}>
            {task.title || '新任务'}
          </span>
          <div className="sidebar-task-meta">
            <StatusDot status={task.status} />
            {task.hasUnread && !active && <span className="sidebar-unread-dot" />}
          </div>
        </div>
        {task.summary && (
          <p className="sidebar-task-preview">{task.summary}</p>
        )}
      </div>
    </button>
  );
}

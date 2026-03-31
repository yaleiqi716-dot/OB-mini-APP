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

// ─── Status dot ───────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: TaskStatus }) {
  const isRunning = ['executing', 'understanding', 'structuring', 'pending', 'queued'].includes(status);
  const isWaiting = ['interacting', 'blocked'].includes(status);
  const isFailed  = status === 'failed';
  if (isRunning) return <span className="ob-status-dot ob-status-dot--running" />;
  if (isWaiting) return <span className="ob-status-dot ob-status-dot--waiting" />;
  if (isFailed)  return <span className="ob-status-dot ob-status-dot--failed" />;
  return null;
}

// ─── Time grouping ─────────────────────────────────────────────────────────────
function getGroup(dateStr: string): 'today' | 'yesterday' | 'week' | 'older' {
  const now  = new Date();
  const date = new Date(dateStr);
  const diffMs   = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 1)  return 'today';
  if (diffDays < 2)  return 'yesterday';
  if (diffDays < 7)  return 'week';
  return 'older';
}
const GROUP_LABEL: Record<string, string> = {
  today:     '今天',
  yesterday: '昨天',
  week:      '最近 7 天',
  older:     '更早',
};

// ─── TaskList ─────────────────────────────────────────────────────────────────
export function TaskList({ tasks, activeTaskId, onSelect }: TaskListProps) {
  if (tasks.length === 0) return null;

  // Running tasks first, then newest first
  const sorted = [...tasks].sort((a, b) => {
    const aRunning = !['completed', 'failed'].includes(a.status);
    const bRunning = !['completed', 'failed'].includes(b.status);
    if (aRunning !== bRunning) return aRunning ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Group by time
  const groups: Record<string, TaskItem[]> = {};
  for (const t of sorted) {
    const g = getGroup(t.createdAt);
    if (!groups[g]) groups[g] = [];
    groups[g].push(t);
  }

  const groupOrder = ['today', 'yesterday', 'week', 'older'];

  return (
    <div className="sidebar-task-list">
      {groupOrder.map((g) => {
        const items = groups[g];
        if (!items?.length) return null;
        return (
          <div key={g} className="sidebar-section">
            <p className="ob-section-label">{GROUP_LABEL[g]}</p>
            {items.map((t) => (
              <SessionRow
                key={t.id}
                task={t}
                active={activeTaskId === t.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Session row ───────────────────────────────────────────────────────────────
function SessionRow({
  task,
  active,
  onSelect,
}: {
  task: TaskItem;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(task.id)}
      className={cn(
        'ob-session-row sidebar-task-row',
        active ? 'ob-session-row--active sidebar-task-row--active' : 'sidebar-task-row--idle'
      )}
    >
      <div className="ob-session-inner" style={{ flexDirection: 'row' }}>
        {/* Text block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={cn('ob-session-title', active && 'ob-session-row--active')}>
            {task.title || '新任务'}
          </div>
          {task.summary && (
            <div className="ob-session-preview">{task.summary}</div>
          )}
        </div>
        {/* Meta: status dot + unread */}
        <div className="ob-session-meta">
          <StatusDot status={task.status} />
          {task.hasUnread && !active && <span className="ob-unread-dot" />}
        </div>
      </div>
    </button>
  );
}

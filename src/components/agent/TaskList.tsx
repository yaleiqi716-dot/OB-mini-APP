'use client';
import { TaskStatus, TaskType, TaskSource } from '@/types/task';
import { cn } from '@/lib/utils';

interface TaskItem {
  id: string;
  type: TaskType;
  status: TaskStatus;
  title: string;
  input?: string;  // user's first message — used as conversation title
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

// ─── Session row — MiniMax style ───────────────────────────────────────────────
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
      style={{
        display: 'block',
        width: '100%',
        border: 'none',
        padding: 0,
        background: active ? 'var(--bg-hover)' : 'transparent',
        cursor: 'pointer',
        borderRadius: 6,
        marginBottom: 1,
        textAlign: 'left',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 10px',
          minHeight: 36,
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontWeight: active ? 500 : 400,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.4,
          }}
        >
          {/* Use user's first message as title, fall back to task title */}
          {(task.input && task.input.trim()) ? task.input.trim() : (task.title || '新对话')}
        </span>
        {/* Only show running indicator, no status labels */}
        {['executing', 'understanding', 'structuring', 'pending', 'queued'].includes(task.status) ? (
          <span className="ob-status-dot ob-status-dot--running" style={{ flexShrink: 0 }} />
        ) : null}
      </div>
    </button>
  );
}

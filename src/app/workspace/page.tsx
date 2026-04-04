'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { WorkspaceHeader, WorkspaceSubNav } from '@/components/workspace/WorkspaceHeader';

interface WsTask {
  id: string;
  title: string;
  description: string | null;
  businessStatus: string;
  priority: number;
  assigneeId: string | null;
  createdBy: string;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceInfo {
  id: string;
  name: string;
  role: string;
  memberCount: number;
  taskCount: number;
}

const STATUS_GROUPS = [
  { key: 'pending', label: '待处理', statuses: ['draft', 'assigned'] },
  { key: 'active', label: '进行中', statuses: ['in_progress'] },
  { key: 'review', label: '待审核', statuses: ['submitted', 'revision'] },
  { key: 'done', label: '已完成', statuses: ['completed'] },
];

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', assigned: '已分配', in_progress: '进行中',
  submitted: '已提交', revision: '需修改', completed: '已完成',
};

const FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'active', label: '进行中' },
  { value: 'review', label: '待审核' },
  { value: 'done', label: '已完成' },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    draft: { bg: 'rgba(156,163,175,0.10)', color: '#6B7280' },
    assigned: { bg: 'rgba(255,122,26,0.10)', color: '#C2410C' },
    in_progress: { bg: 'rgba(255,122,26,0.10)', color: '#C2410C' },
    submitted: { bg: 'rgba(59,130,246,0.10)', color: '#1D4ED8' },
    revision: { bg: 'rgba(239,68,68,0.10)', color: '#B91C1C' },
    completed: { bg: 'rgba(16,185,129,0.10)', color: '#047857' },
  };
  const c = colors[status] || colors.draft;
  return <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', fontSize: 11, fontWeight: 500, borderRadius: 9999, background: c.bg, color: c.color }}>{STATUS_LABEL[status] || status}</span>;
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}天前` : new Date(d).toLocaleDateString('zh-CN');
}

export default function WorkspacePage() {
  const router = useRouter();
  const [ws, setWs] = useState<WorkspaceInfo | null>(null);
  const [tasks, setTasks] = useState<WsTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const m = document.cookie.match(/ob-user-id=([^;]+)/);
    if (!m || !m[1]) { router.replace('/login'); }
  }, [router]);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/workspace').then(r => r.json()),
      fetch('/api/workspace/tasks').then(r => r.json()),
    ]).then(([wsData, tasksData]) => {
      if (wsData?.id) setWs(wsData);
      if (Array.isArray(tasksData)) setTasks(tasksData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let result = tasks;
    if (filter !== 'all') {
      const group = STATUS_GROUPS.find(g => g.key === filter);
      if (group) result = result.filter(t => group.statuses.includes(t.businessStatus));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t => (t.title || '').toLowerCase().includes(q));
    }
    return result;
  }, [tasks, filter, search]);

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F7F7F4' }}>
        <WorkspaceHeader />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 20, height: 20, border: '2px solid #F97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
      </div>
    );
  }

  if (!ws) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F7F7F4' }}>
        <WorkspaceHeader />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#171717', marginBottom: 8 }}>还没有工作区</p>
            <p style={{ fontSize: 14, color: '#7A7A7A', marginBottom: 24 }}>创建一个工作区开始团队协作</p>
            <a href="/workspace/new" style={{
              display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 24px',
              borderRadius: 9999, fontSize: 15, fontWeight: 600,
              background: '#F97316', color: '#fff', textDecoration: 'none',
            }}>创建工作区</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F7F7F4' }}>
      <WorkspaceHeader />
      <WorkspaceSubNav />
      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 60px' }}>
          {/* Title + new task */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 600, color: '#171717', margin: '0 0 6px' }}>{ws.name}</h1>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>{ws.memberCount} 位成员 · {ws.taskCount} 个任务</p>
            </div>
            {ws.role === 'owner' && (
              <a href="/workspace/tasks/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 18px', borderRadius: 9999, fontSize: 14, fontWeight: 500, background: '#F97316', color: '#fff', textDecoration: 'none' }}>
                + 新建任务
              </a>
            )}
          </div>

          {/* Search + filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 260 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input
                type="text" placeholder="搜索任务..." value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', height: 36, borderRadius: 12, border: '1px solid #E7E5E1', background: '#FFFFFF', padding: '0 12px 0 34px', fontSize: 13, color: '#171717', outline: 'none', transition: 'border-color .2s' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#F97316')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E7E5E1')}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {FILTER_OPTIONS.map(f => (
                <button key={f.value} onClick={() => setFilter(f.value)} style={{
                  height: 32, padding: '0 14px', borderRadius: 9999, fontSize: 13,
                  fontWeight: filter === f.value ? 500 : 400,
                  border: filter === f.value ? 'none' : '1px solid #E7E5E1',
                  background: filter === f.value ? 'rgba(255,122,26,0.10)' : '#FFFFFF',
                  color: filter === f.value ? '#F97316' : '#6B7280',
                  cursor: 'pointer', transition: 'all .2s',
                }}>{f.label}</button>
              ))}
            </div>
          </div>

          {/* Task list */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#171717', marginBottom: 6 }}>
                {search || filter !== 'all' ? '没有匹配的任务' : '还没有任务'}
              </p>
              <p style={{ fontSize: 14, color: '#7A7A7A' }}>
                {search || filter !== 'all' ? '换个条件试试' : '创建第一个任务，分配给团队成员'}
              </p>
            </div>
          ) : (
            filter === 'all' && !search.trim() ? (
              // Grouped by status
              STATUS_GROUPS.map(group => {
                const groupTasks = filtered.filter(t => group.statuses.includes(t.businessStatus));
                if (groupTasks.length === 0) return null;
                return (
                  <div key={group.key} style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#9CA3AF', marginBottom: 10 }}>{group.label} ({groupTasks.length})</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {groupTasks.map(t => <TaskCard key={t.id} task={t} />)}
                    </div>
                  </div>
                );
              })
            ) : (
              // Flat list when filtering or searching
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(t => <TaskCard key={t.id} task={t} />)}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: WsTask }) {
  return (
    <a
      href={`/workspace/tasks/${task.id}`}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', border: '1px solid #E7E5E1', borderRadius: 14, padding: '12px 16px', textDecoration: 'none', transition: 'transform .2s, box-shadow .2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#171717', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
          <StatusBadge status={task.businessStatus} />
          {task.priority >= 2 && <span style={{ fontSize: 11, color: '#B91C1C', fontWeight: 500 }}>紧急</span>}
        </div>
        <span style={{ fontSize: 12, color: '#A3A3A3' }}>{timeAgo(task.updatedAt)}</span>
      </div>
    </a>
  );
}

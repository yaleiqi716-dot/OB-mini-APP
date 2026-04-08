'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader, WorkspaceSubNav } from '@/components/workspace/AppHeader';

interface WsTask {
  id: string;
  title: string;
  description: string | null;
  businessStatus: string;
  priority: number;
  assigneeId: string | null;
  assigneeName: string | null;
  createdBy: string;
  dueAt: string | null;
  attachmentCount: number;
  commentCount: number;
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
    draft: { bg: 'rgba(156,163,175,0.10)', color: 'rgba(224,216,208,0.28)' },
    assigned: { bg: 'rgba(255,90,31,0.10)', color: '#C2410C' },
    in_progress: { bg: 'rgba(255,90,31,0.10)', color: '#C2410C' },
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
    const hasSession = document.cookie.includes('ob-session=') || document.cookie.includes('ob-user-id=');
    if (!hasSession) { router.replace('/login'); }
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
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#1E1C1A' }}>
        <AppHeader />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 24, height: 24, border: '2px solid #FF5A1F', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
          <p style={{ fontSize: 14, color: 'rgba(224,216,208,0.55)' }}>加载工作区...</p>
        </div>
      </div>
    );
  }

  if (!ws) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#1E1C1A' }}>
        <AppHeader />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#E0D8D0', marginBottom: 8 }}>还没有工作区</p>
            <p style={{ fontSize: 14, color: 'rgba(224,216,208,0.55)', marginBottom: 24 }}>创建一个工作区开始团队协作</p>
            <a href="/workspace/new" style={{
              display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 24px',
              borderRadius: 9999, fontSize: 15, fontWeight: 600,
              background: '#FF5A1F', color: '#fff', textDecoration: 'none',
            }}>创建工作区</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#1E1C1A' }}>
      <AppHeader />
      <WorkspaceSubNav />
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }} className="custom-scrollbar">
        {/* Command center atmosphere */}
        {/* Command atmosphere + dot grid — separate layers for full coverage */}
        <div className="ob-command-atmosphere" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 500, pointerEvents: 'none', zIndex: 0 }} />
        <div className="ob-dotgrid ob-dotgrid--ws" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 500, zIndex: 0 }} />
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 60px', position: 'relative', zIndex: 1 }}>
          {/* Title + new task */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 600, color: '#E0D8D0', margin: '0 0 6px' }}>{ws.name}</h1>
              <p style={{ fontSize: 13, color: 'rgba(224,216,208,0.55)', margin: 0 }}>{ws.memberCount} 位成员 · {ws.taskCount} 个任务</p>
            </div>
            {ws.role === 'owner' && (
              <a href="/workspace/tasks/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 18px', borderRadius: 9999, fontSize: 14, fontWeight: 500, background: '#FF5A1F', color: '#fff', textDecoration: 'none' }}>
                + 新建任务
              </a>
            )}
          </div>

          {/* Command center summary */}
          {tasks.length > 0 && (() => {
            const active = tasks.filter(t => ['assigned', 'in_progress'].includes(t.businessStatus)).length;
            const review = tasks.filter(t => ['submitted', 'revision'].includes(t.businessStatus)).length;
            const done = tasks.filter(t => t.businessStatus === 'completed').length;
            const overdue = tasks.filter(t => t.dueAt && new Date(t.dueAt).getTime() < Date.now() && t.businessStatus !== 'completed').length;
            return (
              <div className="ob-command-bar">
                <div className="ob-command-stat ob-command-stat--accent">
                  <span className="ob-px-dot ob-px-dot--active" style={{ animation: active > 0 ? 'statusCycle 2s ease-in-out infinite' : 'none', background: active > 0 ? '#FF5A1F' : '#666666', boxShadow: active > 0 ? '0 0 6px rgba(255,90,31,0.4)' : 'none' }} />
                  <span><strong>{active}</strong> 进行中</span>
                </div>
                <div className="ob-command-stat" style={{ color: review > 0 ? '#1D4ED8' : undefined }}>
                  <span><strong>{review}</strong> 待审核</span>
                </div>
                <div className="ob-command-stat ob-command-stat--green">
                  <span><strong>{done}</strong> 已完成</span>
                </div>
                {overdue > 0 && (
                  <div className="ob-command-stat ob-command-stat--red">
                    <span><strong>{overdue}</strong> 已逾期</span>
                  </div>
                )}
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: 'rgba(224,216,208,0.28)', letterSpacing: '0.05em' }}>ACTIVE</span>
                <span style={{ fontSize: 12, color: 'rgba(224,216,208,0.55)' }}>{ws?.memberCount} 位成员协作中</span>
              </div>
            );
          })()}

          {/* Search + filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 260 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(224,216,208,0.55)', pointerEvents: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input
                type="text" placeholder="搜索任务..." value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', height: 36, borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', background: '#252321', padding: '0 12px 0 34px', fontSize: 13, color: '#E0D8D0', outline: 'none', transition: 'border-color .2s' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#FF5A1F')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)')}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {FILTER_OPTIONS.map(f => (
                <button key={f.value} onClick={() => setFilter(f.value)} style={{
                  height: 32, padding: '0 14px', borderRadius: 9999, fontSize: 13,
                  fontWeight: filter === f.value ? 500 : 400,
                  border: filter === f.value ? 'none' : '1px solid rgba(255,255,255,0.04)',
                  background: filter === f.value ? 'rgba(255,90,31,0.10)' : '#252321',
                  color: filter === f.value ? '#FF5A1F' : '#888888',
                  cursor: 'pointer', transition: 'all .2s',
                }}>{f.label}</button>
              ))}
            </div>
          </div>

          {/* Task list */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: '#252321', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CCCCCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="16" x2="12" y2="16"/>
                </svg>
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#E0D8D0', marginBottom: 6 }}>
                {search || filter !== 'all' ? '没有匹配的任务' : '还没有任务'}
              </p>
              <p style={{ fontSize: 14, color: 'rgba(224,216,208,0.55)', marginBottom: search || filter !== 'all' ? 0 : 20 }}>
                {search || filter !== 'all' ? '换个条件试试' : '创建第一个任务，分配给团队成员'}
              </p>
              {!(search || filter !== 'all') && ws?.role === 'owner' && (
                <a href="/workspace/tasks/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 18px', borderRadius: 9999, fontSize: 14, fontWeight: 500, background: '#FF5A1F', color: '#fff', textDecoration: 'none' }}>
                  + 新建任务
                </a>
              )}
            </div>
          ) : (
            filter === 'all' && !search.trim() ? (
              // Grouped by status
              STATUS_GROUPS.map(group => {
                const groupTasks = filtered.filter(t => group.statuses.includes(t.businessStatus));
                if (groupTasks.length === 0) return null;
                return (
                  <div key={group.key} style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(224,216,208,0.55)', marginBottom: 10 }}>{group.label} ({groupTasks.length})</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {groupTasks.map(t => <TaskCard key={t.id} task={t} />)}
                    </div>
                  </div>
                );
              })
            ) : (
              // Flat list when filtering or searching
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
  const hasDue = !!task.dueAt;
  const isOverdue = hasDue && new Date(task.dueAt!).getTime() < Date.now() && task.businessStatus !== 'completed';

  return (
    <a
      href={`/workspace/tasks/${task.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: '#252321', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 14,
        padding: '14px 16px', textDecoration: 'none',
        transition: 'transform .2s, box-shadow .2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Assignee avatar */}
      {task.assigneeName ? (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(255,90,31,0.10)', color: '#FF5A1F',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 600,
        }}>
          {task.assigneeName.slice(0, 1).toUpperCase()}
        </div>
      ) : (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: '#F5F5F5', color: 'rgba(224,216,208,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12,
        }}>?</div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#E0D8D0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{task.title}</span>
          <StatusBadge status={task.businessStatus} />
          {task.priority >= 2 && <span style={{ fontSize: 11, color: '#B91C1C', fontWeight: 500 }}>紧急</span>}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'rgba(224,216,208,0.55)' }}>
          {task.assigneeName && <span>{task.assigneeName}</span>}
          <span>{timeAgo(task.updatedAt)}</span>
          {hasDue && (
            <span style={{ color: isOverdue ? '#B91C1C' : '#CCCCCC' }}>
              {isOverdue ? '已逾期' : `截止 ${new Date(task.dueAt!).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}`}
            </span>
          )}
          {task.attachmentCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              {task.attachmentCount}
            </span>
          )}
          {task.commentCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              {task.commentCount}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

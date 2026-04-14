'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader, WorkspaceSubNav } from '@/components/workspace/AppHeader';
import { Spinner } from '@/components/ui/Spinner';

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

const STATUS_DOT: Record<string, string> = {
  draft: '#6B7280', assigned: '#6B7280', in_progress: '#FF8C5A',
  submitted: '#FBBF24', revision: '#FBBF24', completed: '#34D399',
};

const FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'active', label: '进行中' },
  { value: 'review', label: '待审核' },
  { value: 'done', label: '已完成' },
];

const PRIORITY_LABEL: Record<number, string> = {
  0: '普通', 1: '中', 2: '高', 3: '紧急',
};

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
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--ob-bg)' }}>
        <AppHeader />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Spinner size="md" />
          <p style={{ fontSize: 14, color: 'rgba(245,245,240,0.55)' }}>加载工作区...</p>
        </div>
      </div>
    );
  }

  if (!ws) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--ob-bg)' }}>
        <AppHeader />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--ob-text)', marginBottom: 8 }}>还没有工作区</p>
            <p style={{ fontSize: 14, color: 'rgba(245,245,240,0.55)', marginBottom: 24 }}>创建一个工作区开始团队协作</p>
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
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--ob-bg)' }}>
      <AppHeader />
      <WorkspaceSubNav />
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }} className="custom-scrollbar">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px 60px', position: 'relative', zIndex: 1 }}>

          {/* ── Board header (Monday-style compact) ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'rgba(245,245,240,0.92)' }}>工作区</span>
              <span style={{ fontSize: 12, color: 'rgba(245,245,240,0.28)', marginLeft: 4 }}>{ws.memberCount} 位成员</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,90,31,0.2)', color: '#FF5A1F', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Y</div>
              <a href="/workspace/members" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 99, fontSize: 12, border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(245,245,240,0.55)', background: 'transparent', textDecoration: 'none', transition: 'all 0.12s' }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.borderColor = 'rgba(255,90,31,0.40)'; e.currentTarget.style.color = '#FF5A1F'; }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'rgba(245,245,240,0.55)'; }}
              >邀请 / {ws.memberCount}</a>
            </div>
          </div>

          {/* View tabs */}
          <div style={{ display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {[{ key: 'table', label: '看板' }, { key: 'calendar', label: '日历' }].map(v => (
              <span key={v.key} style={{ padding: '7px 18px', fontSize: 14, cursor: 'pointer', fontWeight: v.key === 'table' ? 500 : 400, color: v.key === 'table' ? '#fff' : 'rgba(245,245,240,0.38)', borderBottom: v.key === 'table' ? '2px solid #FF5A1F' : '2px solid transparent', marginBottom: -1, transition: 'all 0.12s' }}>{v.label}</span>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 4 }}>
            <div style={{ display: 'flex', marginRight: 10 }}>
              <a href="/workspace/tasks/new" style={{ padding: '6px 16px', borderRadius: '99px 0 0 99px', background: '#FF5A1F', color: '#fff', border: 'none', borderRight: '1px solid rgba(255,255,255,0.25)', fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'background 0.12s' }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.background = '#E84D15')}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.background = '#FF5A1F')}
              >+ 新建任务</a>
              <span style={{ padding: '6px 10px', borderRadius: '0 99px 99px 0', background: '#FF5A1F', color: '#fff', fontSize: 12, cursor: 'pointer' }}>&#9662;</span>
            </div>
            {['搜索', '筛选', '排序'].map(b => (
              <button key={b} className="ob-toolbar-btn">{b}</button>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {FILTER_OPTIONS.map(f => (
                <button key={f.value} onClick={() => setFilter(f.value)} style={{
                  height: 26, padding: '0 12px', borderRadius: 9999, fontSize: 11, fontWeight: filter === f.value ? 500 : 400,
                  border: filter === f.value ? '1px solid rgba(255,90,31,0.35)' : '1px solid rgba(255,255,255,0.08)',
                  background: filter === f.value ? 'rgba(255,90,31,0.12)' : 'transparent',
                  color: filter === f.value ? '#FF5A1F' : 'rgba(245,245,240,0.45)', cursor: 'pointer', transition: 'all .12s',
                }}>{f.label}</button>
              ))}
            </div>
          </div>

          {/* ── Task table ── */}
          {filtered.length === 0 ? (
            /* Monday-style guided empty state */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(245,245,240,0.20)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="16" x2="12" y2="16"/>
                </svg>
              </div>
              <p style={{ fontSize: 16, fontWeight: 500, color: 'rgba(245,245,240,0.85)', marginBottom: 8 }}>
                {search || filter !== 'all' ? '没有匹配的任务' : '还没有任何任务'}
              </p>
              <p style={{ fontSize: 13, color: 'rgba(245,245,240,0.35)', marginBottom: 24, maxWidth: 320, lineHeight: 1.6 }}>
                {search || filter !== 'all' ? '换个条件试试' : '在 Agent 里完成的任务会同步到这里，也可以手动创建分配给团队'}
              </p>
              {!(search || filter !== 'all') && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <a href="/agent" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, height: 36, padding: '0 18px',
                    borderRadius: 9999, fontSize: 13, fontWeight: 500,
                    border: '1px solid rgba(255,90,31,0.40)', color: '#FF5A1F',
                    background: 'transparent', textDecoration: 'none', transition: 'all .15s',
                  }}
                    onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.background = '#FF5A1F'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#FF5A1F'; }}
                  >
                    去发起任务
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </a>
                  {ws?.role === 'owner' && (
                    <a href="/workspace/tasks/new" style={{
                      display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 18px',
                      borderRadius: 9999, fontSize: 13, fontWeight: 600,
                      background: '#FF5A1F', color: '#fff', textDecoration: 'none',
                      boxShadow: '0 4px 16px rgba(255,90,31,0.30)',
                    }}>
                      + 手动创建
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Monday-style table rows */
            <div>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'minmax(200px,1fr) 100px 80px 100px 100px',
                padding: '6px 16px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'rgba(245,245,240,0.25)', borderBottom: '1px solid rgba(255,255,255,0.07)',
                fontFamily: 'var(--ob-font-mono)',
              }}>
                <span>任务</span>
                <span>状态</span>
                <span>优先级</span>
                <span>截止</span>
                <span style={{ textAlign: 'right' }}>更新</span>
              </div>

              {/* Task rows */}
              {filtered.map(task => (
                <TaskRow key={task.id} task={task} />
              ))}

              {/* + Add task ghost row */}
              {ws?.role === 'owner' && (
                <a
                  href="/workspace/tasks/new"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px 8px 42px',
                    fontSize: 13, color: 'rgba(245,245,240,0.22)',
                    cursor: 'pointer', transition: 'color 0.12s',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(245,245,240,0.55)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,245,240,0.22)')}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  添加任务
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: WsTask }) {
  const hasDue = !!task.dueAt;
  const isOverdue = hasDue && new Date(task.dueAt!).getTime() < Date.now() && task.businessStatus !== 'completed';
  const isFailed = task.businessStatus === 'revision';
  const dotColor = STATUS_DOT[task.businessStatus] || '#6B7280';

  return (
    <a
      href={`/workspace/tasks/${task.id}`}
      style={{
        display: 'grid', gridTemplateColumns: 'minmax(200px,1fr) 100px 80px 100px 100px',
        alignItems: 'center', padding: '0 16px', height: 48, textDecoration: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        borderLeft: isFailed ? '3px solid rgba(220,38,38,0.50)' : '3px solid transparent',
        transition: 'background 0.12s', cursor: 'pointer',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Task name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {task.assigneeName ? (
          <div style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,90,31,0.12)', color: '#FF5A1F',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600,
          }}>
            {task.assigneeName.slice(0, 1).toUpperCase()}
          </div>
        ) : (
          <div style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,0.06)', color: 'rgba(245,245,240,0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
          }}>?</div>
        )}
        <span style={{
          fontSize: 14, fontWeight: 500, color: 'rgba(245,245,240,0.90)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{task.title}</span>
      </div>

      {/* Status — Monday solid pill */}
      <span className={`ob-status-pill ob-status-pill--${task.businessStatus}`}>
        {STATUS_LABEL[task.businessStatus] || task.businessStatus}
      </span>

      {/* Priority */}
      <span style={{ fontSize: 12, color: task.priority >= 2 ? '#F87171' : 'rgba(245,245,240,0.45)' }}>
        {PRIORITY_LABEL[task.priority] || '普通'}
      </span>

      {/* Due date */}
      <span style={{ fontSize: 12, color: isOverdue ? '#F87171' : 'rgba(245,245,240,0.40)' }}>
        {hasDue ? (isOverdue ? '已逾期' : new Date(task.dueAt!).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })) : '-'}
      </span>

      {/* Updated */}
      <span style={{ fontSize: 12, color: 'rgba(245,245,240,0.35)', textAlign: 'right' }}>
        {timeAgo(task.updatedAt)}
      </span>
    </a>
  );
}

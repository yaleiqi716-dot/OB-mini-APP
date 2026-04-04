'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

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
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', fontSize: 11, fontWeight: 500, borderRadius: 9999, background: c.bg, color: c.color }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
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

  const headerBar = (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, padding: '0 32px', borderBottom: '1px solid #E7E5E1', background: '#F7F7F4', flexShrink: 0 }}>
      <a href="/agent" style={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}>
        <span style={{ color: '#F97316', fontWeight: 700, fontSize: 15 }}>ORANGE</span>
        <span style={{ color: '#171717', fontWeight: 700, fontSize: 15 }}>BENCH</span>
      </a>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <a href="/agent" style={{ fontSize: 13, color: '#9CA3AF', textDecoration: 'none', padding: '4px 10px', borderRadius: 8 }}>AGENT</a>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#F97316', padding: '4px 10px', borderRadius: 8, background: 'rgba(255,122,26,0.10)' }}>工作区</span>
        <a href="/workspace/members" style={{ fontSize: 13, color: '#9CA3AF', textDecoration: 'none', padding: '4px 10px', borderRadius: 8 }}>成员</a>
        <a href="/workspace/settings" style={{ fontSize: 13, color: '#9CA3AF', textDecoration: 'none', padding: '4px 10px', borderRadius: 8 }}>设置</a>
      </nav>
    </header>
  );

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F7F7F4' }}>
        {headerBar}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 20, height: 20, border: '2px solid #F97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
      </div>
    );
  }

  // No workspace — prompt to create
  if (!ws) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F7F7F4' }}>
        {headerBar}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#171717', marginBottom: 8 }}>还没有工作区</p>
            <p style={{ fontSize: 14, color: '#7A7A7A', marginBottom: 24 }}>创建一个工作区开始团队协作</p>
            <button
              onClick={async () => {
                const name = prompt('工作区名称');
                if (!name?.trim()) return;
                const res = await fetch('/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
                if (res.ok) loadData();
              }}
              style={{ height: 40, padding: '0 24px', borderRadius: 9999, fontSize: 15, fontWeight: 600, border: 'none', background: '#F97316', color: '#fff', cursor: 'pointer' }}
            >创建工作区</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F7F7F4' }}>
      {headerBar}
      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 600, color: '#171717', margin: '0 0 8px' }}>{ws.name}</h1>
              <p style={{ fontSize: 14, color: '#7A7A7A', margin: 0 }}>{ws.memberCount} 位成员 · {ws.taskCount} 个任务</p>
            </div>
            {ws.role === 'owner' && (
              <a href="/workspace/tasks/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 18px', borderRadius: 9999, fontSize: 14, fontWeight: 500, background: '#F97316', color: '#fff', textDecoration: 'none' }}>
                + 新建任务
              </a>
            )}
          </div>

          {tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#171717', marginBottom: 6 }}>还没有任务</p>
              <p style={{ fontSize: 14, color: '#7A7A7A' }}>创建第一个任务，分配给团队成员</p>
            </div>
          ) : (
            STATUS_GROUPS.map(group => {
              const groupTasks = tasks.filter(t => group.statuses.includes(t.businessStatus));
              if (groupTasks.length === 0) return null;
              return (
                <div key={group.key} style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#9CA3AF', marginBottom: 10 }}>
                    {group.label} ({groupTasks.length})
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {groupTasks.map(t => (
                      <a
                        key={t.id}
                        href={`/workspace/tasks/${t.id}`}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', border: '1px solid #E7E5E1', borderRadius: 16, padding: '14px 18px', textDecoration: 'none', transition: 'transform .2s, box-shadow .2s' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.04)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: '#171717', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                            <StatusBadge status={t.businessStatus} />
                            {t.priority >= 2 && <span style={{ fontSize: 11, color: '#B91C1C', fontWeight: 500 }}>紧急</span>}
                          </div>
                          <span style={{ fontSize: 12, color: '#A3A3A3' }}>{timeAgo(t.updatedAt)}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

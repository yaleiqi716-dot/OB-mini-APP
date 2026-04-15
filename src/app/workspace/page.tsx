'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getMessages } from '@/lib/i18n';
import { Spinner } from '@/components/ui/Spinner';
import { ProductShell, Panel, SegmentControl, StatusPill, EmptyState } from '@/components/product-shell/ProductShell';

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

const t = getMessages('zh-CN');

const STATUS_GROUPS = [
  { key: 'all', label: '全部', statuses: [] as string[] },
  { key: 'pending', label: '待处理', statuses: ['draft', 'assigned'] },
  { key: 'active', label: '进行中', statuses: ['in_progress'] },
  { key: 'review', label: '待审核', statuses: ['submitted', 'revision'] },
  { key: 'done', label: '已完成', statuses: ['completed'] },
];

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', assigned: '已分配', in_progress: '进行中',
  submitted: '已提交', revision: '需修改', completed: '已完成',
};

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  return `${Math.floor(hrs / 24)}天前`;
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
    if (!hasSession) router.replace('/login');
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
    const group = STATUS_GROUPS.find(g => g.key === filter);
    if (group && group.statuses.length) result = result.filter(task => group.statuses.includes(task.businessStatus));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(task => task.title.toLowerCase().includes(q));
    }
    return result;
  }, [tasks, filter, search]);

  if (loading) {
    return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><Spinner size="md" /></div>;
  }

  return (
    <ProductShell
      hero={<div><h1>{t.workspace.title}</h1><p>{t.workspace.subtitle}</p></div>}
      sidebar={
        <Panel title={t.workspace.infoPanel} description={ws?.name || '未命名工作区'}>
          <p style={{ margin: 0, color: 'var(--ob-text-muted)' }}>{ws?.memberCount || 0} 位成员</p>
          <p style={{ margin: 0, color: 'var(--ob-text-muted)' }}>{ws?.taskCount || tasks.length} 个任务</p>
          <a href="/workspace/members" className="ob-mini-link">成员管理</a>
          <a href="/workspace/settings" className="ob-mini-link">空间设置</a>
        </Panel>
      }
      rightRail={
        <Panel title={t.workspace.collaborationRail} description={t.workspace.collaborationHint}>
          <StatusPill>{`${t.common.currentStatus}：在线协作`}</StatusPill>
          <a href="/workspace/tasks/new" className="ob-mini-link">+ 新建任务</a>
        </Panel>
      }
    >
      <div className="ob-grid-gap">
        <Panel title={t.workspace.boardTitle} description={t.workspace.boardSubtitle}>
          <div className="ob-ws-toolbar">
            <input className="ob-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.workspace.searchPlaceholder} />
            <SegmentControl value={filter} onChange={setFilter} options={STATUS_GROUPS.map(({ key, label }) => ({ value: key, label }))} />
          </div>
          {!ws ? (
            <EmptyState title={t.workspace.emptyWorkspaceTitle} description={t.workspace.emptyWorkspaceDescription} />
          ) : filtered.length === 0 ? (
            <EmptyState title={t.workspace.emptyTaskTitle} description={t.workspace.emptyTaskDescription} />
          ) : (
            <div className="ob-ws-grid">
              {filtered.map((task) => (
                <a key={task.id} href={`/workspace/tasks/${task.id}`} className="ob-ws-row">
                  <span>{task.title}</span>
                  <span>{STATUS_LABEL[task.businessStatus] || task.businessStatus}</span>
                  <span>{timeAgo(task.updatedAt)}</span>
                </a>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </ProductShell>
  );
}

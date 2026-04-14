'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DrawerTask {
  id: string;
  title?: string;
  input?: string;
  status: string;
  createdAt: string;
  conversationId?: string;
}

interface TaskDrawerProps {
  task: DrawerTask | null;
  onClose: () => void;
  onRetry?: (taskId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  queued: '排队中', understanding: '理解中', running: '执行中',
  executing: '执行中', interacting: '待审核', structuring: '规划中',
  completed: '已完成', failed: '失败', cancelled: '已取消',
  draft: '草稿', assigned: '已分配', in_progress: '进行中',
  submitted: '已提交', revision: '需修改', pending: '待处理',
  processing: '进行中',
};

export function TaskDrawer({ task, onClose, onRetry }: TaskDrawerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'detail' | 'log' | 'result'>('detail');

  if (!task) return null;

  const displayTitle = task.title || task.input?.slice(0, 50) || '未命名任务';

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.25)',
        zIndex: 49,
      }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0,
        width: 440, maxWidth: '100vw', height: '100vh',
        background: '#1A1A18',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.45)',
        zIndex: 50,
        display: 'flex', flexDirection: 'column',
        animation: 'ob-drawer-in 0.22s cubic-bezier(0.2,0.7,0.3,1)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(245,245,240,0.35)', padding: 4, borderRadius: 5,
            display: 'flex', alignItems: 'center', transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(245,245,240,0.80)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(245,245,240,0.35)'; }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <span style={{
            fontSize: 15, fontWeight: 600, flex: 1,
            color: 'rgba(245,245,240,0.90)',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>
            {displayTitle}
          </span>

          <button
            title="在 Agent 中打开"
            onClick={() => { onClose(); if (task.conversationId) router.push(`/agent?conversationId=${task.conversationId}`); }}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'rgba(245,245,240,0.28)', padding: 4, borderRadius: 5,
              display: 'flex', alignItems: 'center',
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', padding: '0 18px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          {(['detail', 'log', 'result'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '9px 16px', fontSize: 13,
              color: activeTab === tab ? '#fff' : 'rgba(245,245,240,0.38)',
              borderBottom: activeTab === tab ? '2px solid #FF5A1F' : '2px solid transparent',
              background: 'transparent', border: 'none', cursor: 'pointer',
              marginBottom: -1, transition: 'all 0.12s',
            }}>
              {{ detail: '详情', log: '执行日志', result: '结果' }[tab]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {activeTab === 'detail' && (
            <div>
              {[
                { label: '状态', value: (
                  <span className={`ob-status-pill ob-status-pill--${task.status}`}>
                    {STATUS_LABELS[task.status] || task.status}
                  </span>
                )},
                { label: '创建', value: new Date(task.createdAt).toLocaleString('zh-CN') },
                { label: '输入', value: task.input || '—' },
              ].map((field, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 14, padding: '11px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  alignItems: 'flex-start',
                }}>
                  <span style={{
                    fontSize: 12, color: 'rgba(245,245,240,0.28)',
                    width: 52, flexShrink: 0, paddingTop: 2,
                  }}>{field.label}</span>
                  <span style={{
                    fontSize: 13, color: 'rgba(245,245,240,0.72)',
                    flex: 1, lineHeight: 1.55,
                  }}>{field.value}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'log' && (
            <div style={{ fontSize: 13, color: 'rgba(245,245,240,0.25)', paddingTop: 8 }}>
              暂无执行日志
            </div>
          )}

          {activeTab === 'result' && (
            <div style={{ fontSize: 13, color: 'rgba(245,245,240,0.55)', lineHeight: 1.6 }}>
              {task.status === 'completed'
                ? '任务已完成。点击下方「打开对话」查看完整结果。'
                : task.status === 'failed'
                  ? '任务执行失败。可点击「重试」重新执行。'
                  : '任务尚未完成。'}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div style={{
          padding: '14px 18px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', gap: 10, flexShrink: 0,
        }}>
          {task.status === 'failed' && onRetry && (
            <button
              onClick={() => onRetry(task.id)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(245,245,240,0.55)',
                background: 'transparent', cursor: 'pointer',
                fontSize: 13, transition: 'all 0.12s',
              }}
            >重试</button>
          )}
          <button
            onClick={() => { onClose(); if (task.conversationId) router.push(`/agent?conversationId=${task.conversationId}`); }}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 8,
              background: '#FF5A1F', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#E84D15')}
            onMouseLeave={e => (e.currentTarget.style.background = '#FF5A1F')}
          >打开对话</button>
        </div>
      </div>
    </>
  );
}

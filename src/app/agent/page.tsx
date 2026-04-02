'use client';
import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AgentInput } from '@/components/agent/AgentInput';
import { TaskCanvas } from '@/components/agent/TaskCanvas';
import { TaskList } from '@/components/agent/TaskList';
import { Spinner } from '@/components/ui/Spinner';
import { useSSE } from '@/hooks/useSSE';
import { TaskStatus, TaskType, TaskSource } from '@/types/task';
import { Interaction, ApprovalType } from '@/types/interaction';

interface TaskEvent { type: string; data: Record<string, unknown>; createdAt: string; }
interface TaskState {
  id: string; type: TaskType; status: TaskStatus; title: string; input: string;
  source: TaskSource; createdAt: string; updatedAt: string; events: TaskEvent[];
  eventsLoaded: boolean; currentInteraction: Interaction | null;
  result: Record<string, unknown> | null; lastSeenUpdatedAt: string; context: Record<string, unknown>;
  conversationId?: string;
}

// Conversation type for sidebar list
interface ConversationItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  firstTaskInput: string;
}

function parseTaskFromAPI(data: Record<string, unknown>): TaskState {
  const events: TaskEvent[] = Array.isArray(data.events)
    ? (data.events as Record<string, unknown>[]).map((e) => ({
        type: e.type as string, data: (e.data as Record<string, unknown>) || {},
        createdAt: (e.createdAt as string) || new Date().toISOString(),
      })) : [];
  let currentInteraction: Interaction | null = null;
  if (data.status === 'interacting') {
    const lastIR = [...events].reverse().find((e) => e.type === 'interaction_request');
    if (lastIR) currentInteraction = lastIR.data as unknown as Interaction;
  }
  const now = new Date().toISOString();
  const updatedAt = (data.updatedAt as string) || now;
  return {
    id: data.id as string, type: (data.type as TaskType) || 'unknown',
    status: (data.status as TaskStatus) || 'pending', title: (data.title as string) || '',
    input: (data.input as string) || '', source: (data.source as TaskSource) || 'agent',
    createdAt: (data.createdAt as string) || now, updatedAt, events, eventsLoaded: true,
    currentInteraction, result: (data.result as Record<string, unknown>) || null,
    lastSeenUpdatedAt: updatedAt, context: (data.context as Record<string, unknown>) || {},
    conversationId: (data.conversationId as string) || undefined,
  };
}

function getTaskSummary(task: TaskState): string {
  const evts = task.events;
  for (let i = evts.length - 1; i >= 0; i--) { if (evts[i].type === 'interaction_request') return String(evts[i].data.question || ''); }
  for (let i = evts.length - 1; i >= 0; i--) { if (evts[i].type === 'step_update') { const d = evts[i].data; const text = String(d.text || ''); return d.current && d.total ? `${text} (${d.current}/${d.total})` : text; } }
  for (let i = evts.length - 1; i >= 0; i--) { if (evts[i].type === 'log') return String(evts[i].data.message || ''); }
  return '';
}

const UNREAD_TYPES = new Set(['interaction_request', 'task_completed', 'error', 'approval_requested']);
function hasUnread(task: TaskState): boolean {
  if (!task.lastSeenUpdatedAt) return true;
  for (let i = task.events.length - 1; i >= 0; i--) {
    const e = task.events[i];
    if (UNREAD_TYPES.has(e.type) && e.createdAt > task.lastSeenUpdatedAt) return true;
    if (e.createdAt <= task.lastSeenUpdatedAt) break;
  }
  if (!task.eventsLoaded && task.updatedAt > task.lastSeenUpdatedAt) return true;
  return false;
}

const TERMINAL = new Set(['completed', 'failed']);

const EXAMPLES = [
  { label: '帮我写一封客户跟进邮件', type: 'email',   icon: 'mail' },
  { label: '帮我做一份融资 PPT 结构', type: 'ppt',    icon: 'chart' },
  { label: '帮我分析一个行业趋势',  type: 'unknown', icon: 'search' },
  { label: '帮我生成一条产品视频',  type: 'video',   icon: 'video' },
];

// SVG icon map — no emoji
function ChipIcon({ name }: { name: string }) {
  const s = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, flexShrink: 0 as const };
  if (name === 'mail')   return <svg {...s}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
  if (name === 'chart')  return <svg {...s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
  if (name === 'search') return <svg {...s}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
  if (name === 'video')  return <svg {...s}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;
  return null;
}

// Sidebar conversation list component
function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
}: {
  conversations: ConversationItem[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 2,
            padding: '8px 10px',
            borderRadius: 8,
            border: 'none',
            background: activeConversationId === conv.id ? 'var(--surface-secondary)' : 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            if (activeConversationId !== conv.id)
              e.currentTarget.style.background = 'var(--surface-hover, rgba(255,255,255,0.04))';
          }}
          onMouseLeave={(e) => {
            if (activeConversationId !== conv.id)
              e.currentTarget.style.background = 'transparent';
          }}
        >
          <span style={{
            fontSize: 13,
            fontWeight: activeConversationId === conv.id ? 500 : 400,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
            maxWidth: 180,
          }}>
            {conv.title || conv.firstTaskInput?.slice(0, 30) || '新对话'}
          </span>
        </button>
      ))}
    </div>
  );
}

function AgentPageInner() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    const m = document.cookie.match(/ob-user-id=([^;]+)/);
    if (!m || !m[1]) { router.replace('/login'); return; }
    setAuthChecked(true);
  }, [router]);

  // ── URL params ──
  const searchParams = useSearchParams();
  const urlConvId = searchParams.get('conversationId');

  // ── Conversation state ──
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(urlConvId);
  const currentConvRef = useRef<string | null>(urlConvId);
  currentConvRef.current = currentConversationId;

  // ── Task state (tasks within the current conversation) ──
  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingTaskId, setActionLoadingTaskId] = useState<string | null>(null);
  const [interactingTaskId, setInteractingTaskId] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const prevTaskStatusRef = useRef<Record<string, string>>({});
  const [quota, setQuota] = useState<{ credits: number; plan: string; limits: { maxConcurrent: number; allowedTypes: string[] } } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const canvasEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeTaskId;
  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;

  // Sync URL → state on mount / browser back-forward
  useEffect(() => {
    if (urlConvId && urlConvId !== currentConvRef.current) {
      console.log('[URL SYNC] conversationId from URL:', urlConvId);
      setActiveTaskId(null);
      activeRef.current = null;
      setTasks([]);
      setCurrentConversationId(urlConvId);
      currentConvRef.current = urlConvId;
    }
  }, [urlConvId]);

  // ── SSE: subscribe to active task events ──
  const { reconnecting } = useSSE(activeTaskId, {
    enabled: !!activeTaskId,
    onEvent: useCallback((event: TaskEvent) => {
      const cid = activeRef.current; if (!cid) return;
      setTasks((prev) => prev.map((t) => {
        if (t.id !== cid) return t;
        const now = new Date().toISOString();
        const u = { ...t, events: [...t.events, event], lastSeenUpdatedAt: now, updatedAt: now };
        if (event.type === 'status_change') u.status = event.data.status as TaskStatus;
        if (event.type === 'interaction_request') { u.currentInteraction = event.data as unknown as Interaction; u.status = 'interacting'; }
        if (event.type === 'artifact' && event.data.result) u.result = event.data.result as Record<string, unknown>;
        if (event.type === 'task_completed' && event.data.result) { u.result = event.data.result as Record<string, unknown>; u.status = 'completed'; fetchQuota(); showSuccess('✓ 任务已完成！点击查看结果'); }
        return u;
      }));
    }, []),
  });

  // ── Fetch conversation list ──
  function fetchConversations() {
    fetch('/api/conversations').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setConversations(data);
    }).catch(() => {});
  }
  useEffect(() => { fetchConversations(); }, []);

  // ── Fetch tasks for current conversation ──
  function fetchConversationTasks(convId: string) {
    fetch(`/api/conversations/${convId}/tasks`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        const parsed = data.map((d: Record<string, unknown>) => parseTaskFromAPI(d));
        setTasks(parsed);
        // Auto-select the last task in the conversation
        if (parsed.length > 0) {
          setActiveTaskId(parsed[parsed.length - 1].id);
        }
      }
    }).catch(() => {});
  }

  // When conversation changes, load its tasks
  useEffect(() => {
    if (!currentConversationId) {
      setTasks([]);
      setActiveTaskId(null);
      return;
    }
    fetchConversationTasks(currentConversationId);
  }, [currentConversationId]);

  useEffect(() => {
    if (!activeTaskId) return;
    const t = tasks.find(t => t.id === activeTaskId);
    if (!t || t.eventsLoaded) return;
    fetch(`/api/tasks/${activeTaskId}`).then(r => r.json()).then(d => {
      if (!d || d.error) return;
      setTasks(prev => prev.map(t => t.id !== activeTaskId ? t : parseTaskFromAPI(d)));
    }).catch(() => {});
  }, [activeTaskId, tasks]);

  // Re-fetch active task every 2s while it's in a non-terminal state
  // Stops if conversation changes or task is terminal
  useEffect(() => {
    if (!activeTaskId || !currentConversationId) return;
    const capturedConvId = currentConversationId;
    const capturedTaskId = activeTaskId;
    let stopped = false;
    const iv = setInterval(() => {
      if (stopped || currentConvRef.current !== capturedConvId || activeRef.current !== capturedTaskId) {
        stopped = true; clearInterval(iv); return;
      }
      fetch(`/api/tasks/${capturedTaskId}`).then(r => r.json()).then(d => {
        if (!d || d.error || stopped) return;
        setTasks(prev => {
          const cur = prev.find(t => t.id === capturedTaskId);
          if (!cur || TERMINAL.has(cur.status)) { stopped = true; return prev; }
          return prev.map(t => t.id !== capturedTaskId ? t : parseTaskFromAPI(d));
        });
      }).catch(() => {});
    }, 2000);
    return () => { stopped = true; clearInterval(iv); };
  }, [activeTaskId, currentConversationId]);

  useEffect(() => { if (activeTaskId) setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, lastSeenUpdatedAt: t.updatedAt } : t)); }, [activeTaskId]);

  function showError(m: string) { setErrorToast(m); setTimeout(() => setErrorToast(null), 3000); }
  function showSuccess(m: string) { setSuccessToast(m); setTimeout(() => setSuccessToast(null), 4000); }
  function fetchQuota() { fetch('/api/user').then(r => r.json()).then(d => { if (d.credits !== undefined) setQuota(d); }).catch(() => {}); }
  useEffect(() => { fetchQuota(); }, []);

  useEffect(() => {
    if (!canvasEndRef.current || !activeTaskId) return;
    canvasEndRef.current.scrollIntoView({ behavior: 'smooth' });
  });

  // ── Handle new conversation ──
  async function handleNewChat() {
    console.log('[NEW CHAT TRIGGERED]');
    setActiveTaskId(null);
    activeRef.current = null;
    setTasks([]);
    setCurrentConversationId(null);
    currentConvRef.current = null;
    window.history.pushState(null, '', '/agent');
    setSidebarOpen(false);
  }

  // ── Handle conversation selection ──
  async function handleSelectConversation(convId: string) {
    if (convId === currentConvRef.current) { setSidebarOpen(false); return; }
    console.log('[SELECT CONVERSATION]', convId);
    // Clear old state before loading new conversation
    setActiveTaskId(null);
    activeRef.current = null;
    setTasks([]);
    setCurrentConversationId(convId);
    currentConvRef.current = convId;
    // Update URL without full navigation
    window.history.pushState(null, '', `/agent?conversationId=${convId}`);
    setSidebarOpen(false);
  }

  // ── Handle task submission ──
  async function handleSubmit(input: string, type?: string) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // If no current conversation, create one first
      let convId = currentConvRef.current;
      if (!convId) {
        const cr = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: input.slice(0, 40) }),
        });
        if (!cr.ok) { showError('创建会话失败'); return; }
        const cd = await cr.json();
        convId = cd.id;
        // Update both state and ref immediately to prevent race conditions
        currentConvRef.current = convId;
        setCurrentConversationId(convId);
        window.history.pushState(null, '', `/agent?conversationId=${convId}`);
        setConversations(prev => [{ ...cd, firstTaskInput: input }, ...prev]);
      }

      const r = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, type, conversationId: convId }),
      });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        const errMsg = errData.error || '提交失败，请重试';
        showError(errMsg);
        return;
      }
      const data = await r.json();
      if (data.taskId) {
        const now = new Date().toISOString();
        const dr = await fetch(`/api/tasks/${data.taskId}`); const dd = await dr.json();
        let nt: TaskState;
        if (dd && !dd.error) { nt = parseTaskFromAPI(dd); }
        else { nt = { id: data.taskId, type: data.type || 'unknown', status: 'pending', title: input.slice(0, 50), input, source: 'agent', createdAt: now, updatedAt: now, events: [], eventsLoaded: false, currentInteraction: null, result: null, lastSeenUpdatedAt: now, context: {}, conversationId: convId || undefined }; }
        setTasks(prev => [...prev, nt]);
        setActiveTaskId(data.taskId);
        fetchQuota();
        fetchConversations();
      }
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  }

  async function handleInteractionSubmit(stepId: string, value: unknown) {
    if (!activeTaskId || interactingTaskId === activeTaskId) return;
    setInteractingTaskId(activeTaskId); setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, currentInteraction: null } : t));
    try { const r = await fetch(`/api/tasks/${activeTaskId}/interact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interactionId: '', stepId, value }) }); if (!r.ok) showError('提交失败'); } catch { showError('网络错误'); } finally { setInteractingTaskId(null); }
  }

  async function handleApprove(at: ApprovalType) { if (!activeTaskId || actionLoadingTaskId) return; setActionLoadingTaskId(activeTaskId); try { const r = await fetch(`/api/tasks/${activeTaskId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approvalType: at, action: 'approve' }) }); if (!r.ok) showError('确认失败'); } catch { showError('网络错误'); } finally { setActionLoadingTaskId(null); } }
  async function handleReject(at: ApprovalType) { if (!activeTaskId || actionLoadingTaskId) return; setActionLoadingTaskId(activeTaskId); setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, currentInteraction: null } : t)); try { const r = await fetch(`/api/tasks/${activeTaskId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approvalType: at, action: 'reject' }) }); if (!r.ok) showError('操作失败'); } catch { showError('网络错误'); } finally { setActionLoadingTaskId(null); } }
  async function handleAdjustStructure() { if (!activeTaskId || interactingTaskId === activeTaskId) return; setInteractingTaskId(activeTaskId); setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, currentInteraction: null } : t)); try { await fetch(`/api/tasks/${activeTaskId}/interact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interactionId: '', stepId: 'request_adjust_structure', value: '' }) }); } catch { showError('操作失败'); } finally { setInteractingTaskId(null); } }
  async function handleAdjustProposal() { if (!activeTaskId || interactingTaskId === activeTaskId) return; setInteractingTaskId(activeTaskId); setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, currentInteraction: null } : t)); try { await fetch(`/api/tasks/${activeTaskId}/interact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interactionId: '', stepId: 'request_adjust_proposal_structure', value: '' }) }); } catch { showError('操作失败'); } finally { setInteractingTaskId(null); } }
  async function handleReviseEmail() { if (!activeTaskId || interactingTaskId === activeTaskId) return; setInteractingTaskId(activeTaskId); setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, currentInteraction: null } : t)); try { await fetch(`/api/tasks/${activeTaskId}/interact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interactionId: '', stepId: 'revise_email_request', value: '' }) }); } catch { showError('操作失败'); } finally { setInteractingTaskId(null); } }

  const listItems = tasks.map(t => ({ id: t.id, type: t.type, status: t.status, title: t.title, input: t.input, createdAt: t.createdAt, summary: getTaskSummary(t), hasUnread: hasUnread(t), source: t.source }));

  if (!authChecked) return <div style={{ height: '100dvh', background: 'var(--bg)' }} />;

  // ---- Sidebar content (shared desktop/mobile) ----
  const sidebarContent = (
    <>
      {/* Top: New chat button */}
      <div className="ob-sidebar-top">
        <button
          onClick={() => { console.log('[NEW CHAT TRIGGERED] sidebar btn'); handleNewChat(); }}
          className="ob-new-chat-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          新对话
        </button>
      </div>

      {/* Conversation list */}
      <div className="ob-sidebar-scroll custom-scrollbar">
        {conversations.length > 0 ? (
          <ConversationList
            conversations={conversations}
            activeConversationId={currentConversationId}
            onSelect={handleSelectConversation}
          />
        ) : (
          <p className="ob-sidebar-empty">暂无对话<br />输入一句话开始</p>
        )}
      </div>

      {/* Footer: credits */}
      {quota && (
        <div className="ob-sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Credits</span>
            <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: quota.credits < 20 ? '#ef4444' : 'var(--accent)' }}>
              {quota.credits}
            </span>
          </div>
          {quota.credits < 30 && (
            <a href="/billing" className="sidebar-topup-btn">充值</a>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="ob-shell agent-root">

      {/* ── Header 56px ── */}
      <header className="ob-header">
        <button
          className="ob-header-brand"
          onClick={() => { console.log('[NEW CHAT TRIGGERED] header brand'); handleNewChat(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span className="ob-header-brand-o">ORANGE</span>
          <span className="ob-header-brand-t">BENCH</span>
        </button>
        <div className="ob-header-right">
          <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {[{href:'/dashboard',label:'决策台'},{href:'/tasks',label:'我的任务'},{href:'/review',label:'审核'},{href:'/billing',label:'充值'}].map(({href,label}) => (
              <a key={href} href={href} style={{ fontSize:12, color:'var(--text-faint)', textDecoration:'none', padding:'3px 8px', borderRadius:6, transition:'color 0.15s' }}
                onMouseEnter={e=>(e.currentTarget.style.color='var(--accent)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text-faint)')}>{label}</a>
            ))}
          </nav>
          {quota && <span className="ob-header-plan">{quota.plan || 'Free'}</span>}
          {quota && (
            <span className={`ob-header-credits ${quota.credits < 20 ? 'ob-header-credits-low' : ''}`}>
              {quota.credits} credits
            </span>
          )}
          <div className="ob-header-avatar">U</div>
        </div>
      </header>

      {/* ── Reconnect banner ── */}
      {reconnecting && (
        <div className="ob-reconnect agent-reconnect-banner">连接中断，正在重连...</div>
      )}

      <div className="ob-body agent-layout">
        {/* Left sidebar — desktop */}
        <aside className="ob-sidebar agent-sidebar hidden md:flex">
          {sidebarContent}
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <>
            <div className="ob-sidebar-overlay agent-sidebar-overlay md:hidden" onClick={() => setSidebarOpen(false)} />
            <aside className="ob-sidebar-drawer agent-sidebar--mobile md:hidden">
              {sidebarContent}
            </aside>
          </>
        )}

        {/* ── Main area ── */}
        <main className="ob-main agent-main">
          {/* Mobile topbar */}
          <div className="ob-mobile-bar agent-mobile-topbar md:hidden">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="agent-mobile-menu-btn"
              aria-label="菜单"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className="agent-mobile-title">
              <span style={{ color: 'var(--accent)' }}>ORANGE</span>BENCH
            </span>
            <button
              onClick={() => { console.log('[NEW CHAT TRIGGERED] mobile topbar'); handleNewChat(); }}
              style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          </div>

          {currentConversationId ? (
            tasks.length > 0 ? (
            <>
              {/* Scrollable conversation — show all tasks in this conversation */}
              <div ref={scrollRef} className="ob-scroll agent-scroll custom-scrollbar" key={currentConversationId}>
                <div className="ob-messages agent-content-wrap">
                  {tasks.map((task) => (
                    <div key={task.id}>
                      {/* User message — right-aligned bubble */}
                      <div className="ob-msg-user chat-user-bubble-row">
                        <div className="ob-msg-user-bubble chat-user-bubble">
                          {task.input}
                        </div>
                      </div>

                      {/* AI response area */}
                      <div className="ob-msg-ai chat-ai-area">
                        <TaskCanvas
                          taskId={task.id} title={task.title} type={task.type}
                          status={task.status} input={task.input} events={task.events}
                          currentInteraction={task.id === activeTaskId ? task.currentInteraction : null}
                          onInteractionSubmit={handleInteractionSubmit}
                          onApprove={handleApprove} onReject={handleReject}
                          onAdjustStructure={handleAdjustStructure}
                          onAdjustProposal={handleAdjustProposal}
                          onReviseEmail={handleReviseEmail}
                          actionLoading={actionLoadingTaskId === task.id}
                          result={task.result}
                          loading={!!(task && !task.eventsLoaded)}
                          credits={quota?.credits ?? null}
                          executionStrategy={(task.context.executionStrategy as string) || undefined}
                          modelName={(task.context.model as string) || undefined}
                          onNewTask={handleSubmit}
                        />
                      </div>
                    </div>
                  ))}
                  <div ref={canvasEndRef} />
                </div>
              </div>

              {/* Fixed bottom input */}
              <div className="ob-input-area agent-input-area">
                <AgentInput
                  onSubmit={input => {
                    // 如果当前任务处于文本输入交互态，底部输入框回复就是交互回复
                    const ci = activeTask?.currentInteraction;
                    if (ci && activeTask?.status === 'interacting' &&
                      (ci.type === 'text_input' || ci.type === 'confirm')) {
                      handleInteractionSubmit(ci.stepId, input);
                    } else {
                      handleSubmit(input);
                    }
                  }}
                  disabled={isSubmitting || interactingTaskId === activeTask?.id}
                  placeholder={
                    activeTask?.currentInteraction &&
                    activeTask?.status === 'interacting' &&
                    (activeTask.currentInteraction.type === 'text_input' || activeTask.currentInteraction.type === 'confirm')
                      ? '回复上面的问题...'
                      : '继续对话...'
                  }
                />
                {isSubmitting && (
                  <div className="agent-submitting-hint">
                    <Spinner size="sm" />
                    <span>正在处理...</span>
                  </div>
                )}
              </div>
            </>
            ) : (
              /* Loading conversation tasks */
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spinner size="sm" />
              </div>
            )
          ) : (
            /* ── Welcome / empty state — MiniMax new-chat ── */
            <div className="ob-welcome agent-welcome">
              <div className="ob-welcome-body agent-welcome-body">
                <h1 className="ob-welcome-title agent-welcome-title">
                  有什么我可以帮你？
                </h1>
                <p className="agent-welcome-subtitle">告诉我你的需求，AI 会帮你完成</p>

                {/* Onboarding guide — 3-step cards, shown when no conversations exist */}
                {conversations.length === 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' as const, justifyContent: 'center' }}>
                    {[
                      { step: '1', text: '输入你的需求', sub: '描述你想做什么' },
                      { step: '2', text: 'AI 自动执行', sub: '思考 → 调用工具 → 生成结果' },
                      { step: '3', text: '查看并使用结果', sub: '可复制、跳转、审核' },
                    ].map((s) => (
                      <div key={s.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderRadius: 12, background: 'var(--surface-secondary)', border: '1px solid var(--border)', minWidth: 140, flex: '1 1 140px', maxWidth: 180 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.step}</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{s.text}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{s.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Example chips — MiniMax 横排单行 */}
                <div className="ob-chips agent-examples">
                  {EXAMPLES.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => handleSubmit(ex.label, ex.type)}
                      disabled={isSubmitting}
                      className="ob-chip agent-example-btn"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <ChipIcon name={ex.icon} />
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input at bottom of welcome */}
              <div className="ob-input-area agent-input-area">
                <AgentInput
                  onSubmit={input => handleSubmit(input)}
                  disabled={isSubmitting}
                  placeholder="说一句话，我来帮你完成"
                  prominent
                />
                {isSubmitting && (
                  <div className="agent-submitting-hint">
                    <Spinner size="sm" />
                    <span>正在处理...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Error toast */}
      {errorToast && (
        <div className="ob-toast agent-error-toast animate-flow-in">
          {errorToast}
        </div>
      )}
      {/* Success toast */}
      {successToast && (
        <div className="ob-toast animate-flow-in" style={{ background: 'var(--color-success, #16a34a)', color: '#fff', bottom: errorToast ? '80px' : '24px' }}>
          {successToast}
        </div>
      )}
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={<div style={{ height: '100dvh', background: 'var(--bg)' }} />}>
      <AgentPageInner />
    </Suspense>
  );
}

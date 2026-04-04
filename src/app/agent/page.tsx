'use client';
import { useState, useCallback, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AgentInput } from '@/components/agent/AgentInput';
import { TaskCanvas } from '@/components/agent/TaskCanvas';
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

const TERMINAL = new Set(['completed', 'failed']);

const EXAMPLES = [
  { label: '定时任务', type: 'unknown', icon: 'clock' },
  { label: '调研报告', type: 'proposal', icon: 'search' },
  { label: 'AI PPT',  type: 'ppt',     icon: 'chart' },
  { label: '优化文案', type: 'email',   icon: 'edit' },
];

function ChipIcon({ name }: { name: string }) {
  const s = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, flexShrink: 0 as const };
  if (name === 'clock')  return <svg {...s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
  if (name === 'search') return <svg {...s}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
  if (name === 'chart')  return <svg {...s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
  if (name === 'edit')   return <svg {...s}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
  return null;
}

// ── Sidebar: group conversations by date ──
function groupByDate(conversations: ConversationItem[]): { label: string; items: ConversationItem[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 6 * 86400000;

  const today: ConversationItem[] = [];
  const week: ConversationItem[] = [];
  const older: ConversationItem[] = [];

  for (const c of conversations) {
    const t = new Date(c.updatedAt || c.createdAt).getTime();
    if (t >= todayStart) today.push(c);
    else if (t >= weekStart) week.push(c);
    else older.push(c);
  }

  const groups: { label: string; items: ConversationItem[] }[] = [];
  if (today.length) groups.push({ label: '今天', items: today });
  if (week.length) groups.push({ label: '近 7 天', items: week });
  if (older.length) groups.push({ label: '更早', items: older });
  return groups;
}

// ── Sidebar icons ──
function SidebarIcon({ name }: { name: string }) {
  const s = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'tasks') return <svg {...s}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
  if (name === 'dashboard') return <svg {...s}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
  if (name === 'review') return <svg {...s}><polyline points="20 6 9 17 4 12"/></svg>;
  if (name === 'settings') return <svg {...s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
  if (name === 'account') return <svg {...s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  return null;
}

// ── Capability card icons ──
function CapIcon({ name }: { name: string }) {
  const s = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'office') return <svg {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
  if (name === 'finance') return <svg {...s}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
  if (name === 'coding') return <svg {...s}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
  return null;
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

  // ── Task state ──
  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingTaskId, setActionLoadingTaskId] = useState<string | null>(null);
  const [interactingTaskId, setInteractingTaskId] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ credits: number; plan: string; limits: { maxConcurrent: number; allowedTypes: string[] } } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const canvasEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeTaskId;
  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;

  // Sync URL → state: handle both navigating TO a conversation and BACK to welcome
  useEffect(() => {
    if (urlConvId !== currentConvRef.current) {
      setActiveTaskId(null);
      activeRef.current = null;
      setTasks([]);
      setCurrentConversationId(urlConvId);
      currentConvRef.current = urlConvId;
    }
  }, [urlConvId]);

  // Listen for browser back/forward (popstate)
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      const convId = params.get('conversationId');
      if (convId !== currentConvRef.current) {
        setActiveTaskId(null);
        activeRef.current = null;
        setTasks([]);
        setCurrentConversationId(convId);
        currentConvRef.current = convId;
      }
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ── SSE ──
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
        if (event.type === 'task_completed' && event.data.result) { u.result = event.data.result as Record<string, unknown>; u.status = 'completed'; fetchQuota(); showSuccess('任务已完成'); }
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
        if (parsed.length > 0) {
          setActiveTaskId(parsed[parsed.length - 1].id);
        }
      }
    }).catch(() => {});
  }

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

  // Re-fetch active task every 2s while non-terminal
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
    setActiveTaskId(null);
    activeRef.current = null;
    setTasks([]);
    setCurrentConversationId(convId);
    currentConvRef.current = convId;
    window.history.pushState(null, '', `/agent?conversationId=${convId}`);
    setSidebarOpen(false);
  }

  // ── Handle task submission ──
  async function handleSubmit(input: string, type?: string) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
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

  // ── Filtered conversations ──
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c =>
      (c.title || '').toLowerCase().includes(q) ||
      (c.firstTaskInput || '').toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const conversationGroups = useMemo(() => groupByDate(filteredConversations), [filteredConversations]);

  if (!authChecked) return <div style={{ height: '100dvh', background: '#F7F7F5' }} />;

  // ── Sidebar content ──
  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="ob-sidebar-brand">
        <div className="ob-sidebar-brand-title">
          <span style={{ color: 'var(--accent)' }}>ORANGE</span>
          <span style={{ color: 'var(--text-primary)' }}>BENCH</span>
        </div>
        <div className="ob-sidebar-brand-sub">AI AGENT</div>
      </div>

      {/* New chat button */}
      <div className="ob-sidebar-top">
        <button onClick={handleNewChat} className="ob-new-chat-btn" aria-label="新建对话">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新建对话
        </button>
      </div>

      {/* Search */}
      <div className="ob-sidebar-search">
        <div className="ob-sidebar-search-wrap">
          <span className="ob-sidebar-search-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </span>
          <input
            type="text"
            className="ob-sidebar-search-input"
            placeholder="搜索对话..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Conversation list grouped */}
      <div className="ob-sidebar-scroll custom-scrollbar">
        {conversationGroups.length > 0 ? (
          conversationGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: 4 }}>
              <div className="ob-section-label">{group.label}</div>
              {group.items.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`ob-session-row ${currentConversationId === conv.id ? 'ob-session-row--active' : ''}`}
                >
                  <div className="ob-session-inner">
                    <span className="ob-session-title">
                      {conv.title || conv.firstTaskInput?.slice(0, 30) || '新对话'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ))
        ) : (
          <p className="ob-sidebar-empty">暂无历史对话</p>
        )}
      </div>

      {/* Footer nav */}
      <div className="ob-sidebar-footer">
        {[
          { href: '/tasks', icon: 'tasks', label: '任务' },
          { href: '/dashboard', icon: 'dashboard', label: '总览' },
          { href: '/review', icon: 'review', label: '处理' },
          { href: '/workspace', icon: 'dashboard', label: '工作区' },
          { href: '/settings', icon: 'settings', label: '设置' },
          { href: '/account', icon: 'account', label: '账户' },
        ].map(n => (
          <a key={n.href} href={n.href} className="ob-sidebar-footer-item">
            <SidebarIcon name={n.icon} />
            <span>{n.label}</span>
          </a>
        ))}
      </div>
    </>
  );

  return (
    <div className="ob-shell agent-root">
      {/* Reconnect banner */}
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
              onClick={handleNewChat}
              aria-label="新建对话"
              style={{ padding: '4px 8px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {currentConversationId ? (
            tasks.length > 0 ? (
            <>
              {/* Scrollable conversation */}
              <div ref={scrollRef} className="ob-scroll agent-scroll custom-scrollbar" key={currentConversationId}>
                <div className="ob-messages agent-content-wrap">
                  {tasks.map((task) => (
                    <div key={task.id}>
                      {/* User message — orange bubble */}
                      <div className="ob-msg-user chat-user-bubble-row">
                        <div className="ob-msg-user-bubble chat-user-bubble">
                          {task.input}
                        </div>
                      </div>

                      {/* AI response */}
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
                  chatMode
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
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spinner size="sm" />
              </div>
            )
          ) : (
            /* ── Welcome state ── */
            <div className="ob-welcome agent-welcome">
              <div className="ob-welcome-body agent-welcome-body">
                <h1 className="ob-welcome-title agent-welcome-title">
                  把任务交给 <span style={{ color: 'var(--accent)' }}>ORANGEBENCH</span>
                </h1>
                <p className="agent-welcome-subtitle">输入你的需求，Agent 会理解、执行并完成</p>

                {/* Main input */}
                <div style={{ width: '100%', maxWidth: 720, marginBottom: 20 }}>
                  <AgentInput
                    onSubmit={input => handleSubmit(input)}
                    disabled={isSubmitting}
                    placeholder="描述你的任务，例如：帮我写一份行业调研报告..."
                    prominent
                  />
                  {isSubmitting && (
                    <div className="agent-submitting-hint">
                      <Spinner size="sm" />
                      <span>正在处理...</span>
                    </div>
                  )}
                </div>

                {/* Chips */}
                <div className="ob-chips agent-examples">
                  {EXAMPLES.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => handleSubmit(ex.label, ex.type)}
                      disabled={isSubmitting}
                      className="ob-chip agent-example-btn"
                    >
                      <ChipIcon name={ex.icon} />
                      {ex.label}
                    </button>
                  ))}
                </div>

                {/* Capability cards */}
                <div className="ob-cap-cards">
                  {[
                    { icon: 'office', title: 'Office', desc: '文档、PPT、邮件' },
                    { icon: 'finance', title: 'Finance', desc: '报表、分析、预测' },
                    { icon: 'coding', title: 'Coding', desc: '代码、调试、方案' },
                  ].map((cap) => (
                    <div key={cap.icon} className="ob-cap-card">
                      <div className="ob-cap-card-icon">
                        <CapIcon name={cap.icon} />
                      </div>
                      <div className="ob-cap-card-title">{cap.title}</div>
                      <div className="ob-cap-card-desc">{cap.desc}</div>
                    </div>
                  ))}
                </div>
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
        <div className="ob-toast animate-flow-in" style={{ background: 'rgba(34,197,94,0.92)', color: '#fff', bottom: errorToast ? '80px' : '24px' }}>
          {successToast}
        </div>
      )}
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={<div style={{ height: '100dvh', background: '#F7F7F5' }} />}>
      <AgentPageInner />
    </Suspense>
  );
}

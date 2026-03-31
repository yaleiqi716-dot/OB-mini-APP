'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  { label: '✉️  写一封客户跟进邮件', type: 'email' },
  { label: '📊  做一份融资 PPT 结构', type: 'ppt' },
  { label: '🔍  分析行业趋势', type: 'unknown' },
  { label: '🎬  生成产品介绍视频', type: 'video' },
];

export default function AgentPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    const m = document.cookie.match(/ob-user-id=([^;]+)/);
    if (!m || !m[1]) { router.replace('/login'); return; }
    setAuthChecked(true);
  }, [router]);

  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingTaskId, setActionLoadingTaskId] = useState<string | null>(null);
  const [interactingTaskId, setInteractingTaskId] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ credits: number; plan: string; limits: { maxConcurrent: number; allowedTypes: string[] } } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const canvasEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeTaskId;
  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;

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
        if (event.type === 'task_completed' && event.data.result) { u.result = event.data.result as Record<string, unknown>; u.status = 'completed'; fetchQuota(); }
        return u;
      }));
    }, []),
  });

  useEffect(() => {
    function poll() {
      fetch('/api/tasks').then(r => r.json()).then(data => {
        if (!Array.isArray(data)) return;
        setTasks(prev => {
          const pm = new Map(prev.map(t => [t.id, t])); const merged: TaskState[] = []; const cid = activeRef.current;
          for (const t of data as Record<string, unknown>[]) {
            const id = t.id as string, su = (t.updatedAt as string) || '', ss = (t.status as TaskStatus) || 'pending', ex = pm.get(id);
            if (ex) {
              if (id === cid) { merged.push({ ...ex, title: (t.title as string) || ex.title, type: (t.type as TaskType) || ex.type, source: (t.source as TaskSource) || ex.source, updatedAt: su > ex.updatedAt ? su : ex.updatedAt, lastSeenUpdatedAt: su > ex.lastSeenUpdatedAt ? su : ex.lastSeenUpdatedAt }); }
              else { const upd = !TERMINAL.has(ex.status) || TERMINAL.has(ss); merged.push({ ...ex, type: (t.type as TaskType) || ex.type, status: upd ? ss : ex.status, title: (t.title as string) || ex.title, source: (t.source as TaskSource) || ex.source, updatedAt: su || ex.updatedAt, result: (t.result as Record<string, unknown>) || ex.result, lastSeenUpdatedAt: ex.lastSeenUpdatedAt }); }
            } else { const now = new Date().toISOString(); merged.push({ id, type: (t.type as TaskType) || 'unknown', status: ss, title: (t.title as string) || '', input: (t.input as string) || '', source: (t.source as TaskSource) || 'agent', createdAt: (t.createdAt as string) || now, updatedAt: su || now, events: [], eventsLoaded: false, currentInteraction: null, result: (t.result as Record<string, unknown>) || null, lastSeenUpdatedAt: '', context: {} }); }
          }
          // ChatGPT model: do NOT auto-open old tasks on load
          return merged;
        });
      }).catch(() => {});
    }
    poll(); const iv = setInterval(poll, 5000); return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!activeTaskId) return;
    const t = tasks.find(t => t.id === activeTaskId);
    if (!t || t.eventsLoaded) return;
    fetch(`/api/tasks/${activeTaskId}`).then(r => r.json()).then(d => {
      if (!d || d.error) return;
      setTasks(prev => prev.map(t => t.id !== activeTaskId ? t : parseTaskFromAPI(d)));
    }).catch(() => {});
  }, [activeTaskId, tasks]);

  useEffect(() => { if (activeTaskId) setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, lastSeenUpdatedAt: t.updatedAt } : t)); }, [activeTaskId]);

  function showError(m: string) { setErrorToast(m); setTimeout(() => setErrorToast(null), 3000); }
  function fetchQuota() { fetch('/api/user').then(r => r.json()).then(d => { if (d.credits !== undefined) setQuota(d); }).catch(() => {}); }
  useEffect(() => { fetchQuota(); }, []);

  useEffect(() => {
    if (!canvasEndRef.current || !activeTaskId) return;
    canvasEndRef.current.scrollIntoView({ behavior: 'smooth' });
  });

  async function handleSubmit(input: string, type?: string) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const r = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, type }) });
      if (!r.ok) { showError('提交失败，请重试'); return; }
      const data = await r.json();
      if (data.taskId) {
        const now = new Date().toISOString();
        const think: TaskEvent = { type: 'thinking', data: { text: '好，我来帮你处理这个任务，我先把整体思路理一下' }, createdAt: now };
        const dr = await fetch(`/api/tasks/${data.taskId}`); const dd = await dr.json();
        let nt: TaskState;
        if (dd && !dd.error) { nt = parseTaskFromAPI(dd); if (nt.events.length === 0) nt.events = [think]; }
        else { nt = { id: data.taskId, type: data.type || 'unknown', status: 'pending', title: input.slice(0, 50), input, source: 'agent', createdAt: now, updatedAt: now, events: [think], eventsLoaded: false, currentInteraction: null, result: null, lastSeenUpdatedAt: now, context: {} }; }
        setTasks(prev => [nt, ...prev]); setActiveTaskId(data.taskId); fetchQuota();
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

  function selectTask(id: string) { setActiveTaskId(id); setSidebarOpen(false); }

  const listItems = tasks.map(t => ({ id: t.id, type: t.type, status: t.status, title: t.title, createdAt: t.createdAt, summary: getTaskSummary(t), hasUnread: hasUnread(t), source: t.source }));

  if (!authChecked) return <div style={{ height: '100dvh', background: 'var(--bg)' }} />;

  // ---- Sidebar content (shared desktop/mobile) ----
  const sidebarContent = (
    <>
      {/* Top: New chat button */}
      <div className="ob-sidebar-top">
        <button
          onClick={() => { setActiveTaskId(null); setSidebarOpen(false); }}
          className="ob-new-chat-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          新对话
        </button>
      </div>

      {/* Task list */}
      <div className="ob-sidebar-scroll custom-scrollbar">
        {tasks.length > 0 ? (
          <TaskList tasks={listItems} activeTaskId={activeTaskId} onSelect={selectTask} />
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
          <a href="/billing" className="sidebar-topup-btn">充值</a>
        </div>
      )}
    </>
  );

  return (
    <div className="ob-shell agent-root">

      {/* ── Header 56px ── */}
      <header className="ob-header">
        <a
          href="/agent"
          className="ob-header-brand"
          onClick={(e) => { e.preventDefault(); setActiveTaskId(null); }}
        >
          <span className="ob-header-brand-o">ORANGE</span>
          <span className="ob-header-brand-t">BENCH</span>
        </a>
        <div className="ob-header-right">
          {quota && <span className="ob-header-plan">{quota.plan || 'Free'}</span>}
          {quota && (
            <span className={`ob-header-credits ${quota.credits < 20 ? 'ob-header-credits-low' : ''}`}>
              {quota.credits} credits
            </span>
          )}
          <a href="/billing" className="ob-header-topup">充值</a>
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
            <div style={{ width: 36 }} />
          </div>

          {activeTask ? (
            <>
              {/* Scrollable conversation */}
              <div ref={scrollRef} className="ob-scroll agent-scroll custom-scrollbar" key={activeTask.id}>
                <div className="ob-messages agent-content-wrap">
                  {/* User message — right-aligned bubble */}
                  <div className="ob-msg-user chat-user-bubble-row">
                    <div className="ob-msg-user-bubble chat-user-bubble">
                      {activeTask.input}
                    </div>
                  </div>

                  {/* AI response area */}
                  <div className="ob-msg-ai chat-ai-area">
                    <TaskCanvas
                      taskId={activeTask.id} title={activeTask.title} type={activeTask.type}
                      status={activeTask.status} input={activeTask.input} events={activeTask.events}
                      currentInteraction={activeTask.currentInteraction}
                      onInteractionSubmit={handleInteractionSubmit}
                      onApprove={handleApprove} onReject={handleReject}
                      onAdjustStructure={handleAdjustStructure}
                      onAdjustProposal={handleAdjustProposal}
                      onReviseEmail={handleReviseEmail}
                      actionLoading={actionLoadingTaskId === activeTask.id}
                      result={activeTask.result}
                      loading={!!(activeTask && !activeTask.eventsLoaded)}
                      credits={quota?.credits ?? null}
                      executionStrategy={(activeTask.context.executionStrategy as string) || undefined}
                      modelName={(activeTask.context.model as string) || undefined}
                      onNewTask={handleSubmit}
                    />
                    <div ref={canvasEndRef} />
                  </div>
                </div>
              </div>

              {/* Fixed bottom input */}
              <div className="ob-input-area agent-input-area">
                <AgentInput
                  onSubmit={input => handleSubmit(input)}
                  disabled={isSubmitting}
                  placeholder="继续说，我帮你接着做..."
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
            /* ── Welcome / empty state — MiniMax new-chat ── */
            <div className="ob-welcome agent-welcome">
              <div className="ob-welcome-body agent-welcome-body">
                <h1 className="ob-welcome-title agent-welcome-title">
                  今天想完成什么？
                </h1>
                <p className="agent-welcome-subtitle">说一句话，ORANGEBENCH Agent 帮你搞定</p>

                {/* Example chips — MiniMax 横排单行 */}
                <div className="ob-chips agent-examples">
                  {EXAMPLES.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => handleSubmit(ex.label, ex.type)}
                      disabled={isSubmitting}
                      className="ob-chip agent-example-btn"
                    >
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
    </div>
  );
}

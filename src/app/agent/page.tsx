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
  { label: '帮我写一封客户跟进邮件', type: 'email' },
  { label: '帮我做一份融资PPT结构', type: 'ppt' },
  { label: '帮我分析行业趋势', type: 'unknown' },
  { label: '帮我生成一个产品介绍视频', type: 'video' },
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
          if (!cid && merged.length > 0) { const w = merged.find(t => t.status === 'interacting' || t.status === 'structuring'); if (w) setActiveTaskId(w.id); }
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
    const el = scrollRef.current; if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) canvasEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTask?.events.length]);

  async function handleSubmit(input: string, type?: string) {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, type: type || undefined, source: 'agent' }) });
      const data = await res.json();
      if (!res.ok) { showError(data.error || '创建任务失败'); return; }
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

  if (!authChecked) return <div className="h-[100dvh] bg-surface-primary" />;

  // ---- Sidebar content (shared desktop/mobile) ----
  const sidebarContent = (
    <>
      <div style={{ padding: 12 }}>
        <button
          onClick={() => { setActiveTaskId(null); setSidebarOpen(false); }}
          style={{ width: '100%', height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, fontSize: 13 }}
          className="text-content-secondary hover:bg-surface-tertiary transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          新任务
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: '0 12px 12px' }}>
        {tasks.length > 0 ? (
          <TaskList tasks={listItems} activeTaskId={activeTaskId} onSelect={selectTask} />
        ) : (
          <p style={{ fontSize: 12, textAlign: 'center', padding: '32px 0' }} className="text-content-tertiary">暂无任务</p>
        )}
      </div>
    </>
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-surface-primary">
      {/* ---- HEADER 56px ---- */}
      <header className="flex items-center justify-between flex-shrink-0 border-b border-border/30" style={{ height: 56, padding: '0 24px' }}>
        <div className="flex items-center" style={{ gap: 12 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-1.5 rounded-lg hover:bg-surface-tertiary text-content-tertiary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
          <span style={{ fontSize: 14, fontWeight: 600 }} className="text-content-primary">
            <span className="text-accent">ORANGE</span>BENCH
          </span>
        </div>
        {quota ? (
          <div className="flex items-center" style={{ gap: 12, fontSize: 12 }}>
            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-medium bg-surface-tertiary text-content-tertiary hidden sm:inline">{quota.plan}</span>
            <span className={`px-1.5 py-0.5 rounded font-medium tabular-nums ${quota.credits < 20 ? 'bg-red-500/10 text-red-400' : 'bg-accent/10 text-accent'}`}>{quota.credits}</span>
            <a href="/billing" className="px-2.5 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-[11px] font-medium">充值</a>
          </div>
        ) : null}
      </header>

      {reconnecting ? (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-center text-xs text-amber-400 flex-shrink-0" style={{ padding: '6px 16px' }}>连接中断，正在重连...</div>
      ) : null}

      <div className="flex-1 flex overflow-hidden">
        {/* ---- LEFT SIDEBAR 280px (desktop) ---- */}
        <aside className="hidden md:flex flex-col flex-shrink-0 border-r border-border/20" style={{ width: 280 }}>
          {sidebarContent}
        </aside>

        {/* ---- Mobile sidebar ---- */}
        {sidebarOpen ? (
          <>
            <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
            <aside className="fixed left-0 bottom-0 bg-surface-primary border-r border-border/20 z-50 md:hidden flex flex-col" style={{ top: 56, width: 280 }}>
              {sidebarContent}
            </aside>
          </>
        ) : null}

        {/* ---- MAIN AREA ---- */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTask ? (
            <>
              {/* Scrollable canvas */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar" key={activeTask.id}>
                <div style={{ maxWidth: 860, margin: '0 auto', padding: 24 }}>
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

              {/* Fixed input */}
              <div className="flex-shrink-0 border-t border-border/20" style={{ padding: '12px 24px 16px' }}>
                <AgentInput onSubmit={input => handleSubmit(input)} disabled={isSubmitting} placeholder="继续说，我帮你接着做..." />
                {isSubmitting ? <div className="flex items-center justify-center gap-2 text-content-tertiary text-xs" style={{ marginTop: 8 }}><Spinner size="sm" /><span>正在处理...</span></div> : null}
              </div>
            </>
          ) : (
            /* ---- WELCOME / EMPTY STATE ---- */
            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex items-center justify-center" style={{ padding: 24 }}>
                <div style={{ width: '100%', maxWidth: 720 }}>
                  <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16, textAlign: 'center' }} className="text-content-primary">
                    我可以帮你自动完成工作
                  </h1>
                  <p style={{ fontSize: 14, textAlign: 'center', marginBottom: 32 }} className="text-content-tertiary">
                    输入任务，或点击下方示例开始
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {EXAMPLES.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => handleSubmit(ex.label, ex.type)}
                        disabled={isSubmitting}
                        style={{ height: 36, paddingLeft: 16, paddingRight: 16, borderRadius: 8, fontSize: 13, textAlign: 'left' }}
                        className="border border-border/30 text-content-secondary hover:bg-surface-tertiary hover:border-accent/20 transition-all disabled:opacity-50"
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 border-t border-border/20" style={{ padding: '12px 24px 16px' }}>
                <AgentInput onSubmit={input => handleSubmit(input)} disabled={isSubmitting} placeholder="我可以帮你自动完成工作" prominent />
                {isSubmitting ? <div className="flex items-center justify-center gap-2 text-content-tertiary text-xs" style={{ marginTop: 8 }}><Spinner size="sm" /><span>正在处理...</span></div> : null}
              </div>
            </div>
          )}
        </main>
      </div>

      {errorToast ? (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 animate-flow-in" style={{ bottom: 80 }}>
          <div className="px-4 py-2 rounded-lg bg-red-500/90 text-white text-sm shadow-lg">{errorToast}</div>
        </div>
      ) : null}
    </div>
  );
}

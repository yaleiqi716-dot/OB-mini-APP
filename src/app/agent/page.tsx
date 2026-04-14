'use client';
import { useState, useCallback, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AgentInput } from '@/components/agent/AgentInput';
import { TaskCanvas } from '@/components/agent/TaskCanvas';
import { Spinner } from '@/components/ui/Spinner';
import { ProductShell, Panel, StatusPill, ActionChip } from '@/components/product-shell/ProductShell';
import { getMessages } from '@/lib/i18n';
import { useSSE } from '@/hooks/useSSE';
import { TaskStatus, TaskType, TaskSource } from '@/types/task';
import { Interaction, ApprovalType } from '@/types/interaction';

interface TaskEvent { type: string; data: Record<string, unknown>; createdAt: string; }
const t = getMessages('zh-CN');
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
  skillRoleId?: string | null;
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

// Quick actions — SPLIT into two zones per the PM audit's "unify the
// mental model" finding. Previously 6 cards mixed href-navigate and
// in-place-action behaviors, so clicking any card was a coin flip.
//
// New rules:
//  - QUICK_ACTIONS (primary grid): ALL cards prefill the composer
//    with a concrete, runnable prompt. Clicking one never leaves
//    /agent. Three cards, each one a real task the user could ship.
//  - QUICK_NAV (secondary row): small text links for navigation-
//    only destinations. Visually distinct — these ARE jumps away,
//    and they're labeled as such.
//
// The split makes the first-glance scan answer "what happens when I
// click this?" correctly 100% of the time.

const QUICK_ACTIONS = [
  {
    label: '写一封客户跟进邮件',
    desc: '语气专业、带明确 CTA',
    icon: 'doc',
    action: '帮我给客户写一封简短的跟进邮件,确认下周三的会议。语气专业友好,最后带一个明确的回复 CTA。',
    type: 'unknown',
  },
  {
    label: '提炼会议纪要行动项',
    desc: '5 条任务 · 每条带 owner',
    icon: 'check',
    action: '我给你一段会议纪要,帮我提炼出 5 个具体行动项,每个标注 owner 和建议的截止时间。会议内容:今天产品评审会讨论了 Q2 路线图,张三负责需求文档,李四负责设计评审,预计两周内完成...',
    type: 'unknown',
  },
  {
    label: '写一段发布文案',
    desc: '150 字 · 可发朋友圈',
    icon: 'package',
    action: '帮我写一段 150 字以内的产品发布文案,重点突出"AI 帮你完成任务,你只负责审核"这个核心卖点,语气轻松有力,适合发朋友圈和微博。',
    type: 'unknown',
  },
];

// Secondary: navigation-only shortcuts. Small, clearly "go somewhere"
// styled, not mixed with the action cards.
const QUICK_NAV = [
  { label: '我的任务', desc: '查看所有执行进度', href: '/tasks', icon: 'activity' },
  { label: '团队工作区', desc: '分配任务 · 管理成员', href: '/workspace', icon: 'team' },
  { label: '账户 & 额度', desc: '积分 · 充值 · 设置', href: '/account', icon: 'users' },
];

const STATUS_WORDS = ['理解任务中', '拆解需求中', '组织方案中', '生成内容中', '整理交付中'];

function ActionIcon({ name }: { name: string }) {
  const s = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'team') return <svg {...s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (name === 'doc') return <svg {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
  if (name === 'check') return <svg {...s}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
  if (name === 'package') return <svg {...s}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
  if (name === 'users') return <svg {...s}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>;
  if (name === 'activity') return <svg {...s}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
  return null;
}

function LiveStatusCycle() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setIdx(i => (i + 1) % STATUS_WORDS.length), 2500);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="ob-live-status">
      <span className="ob-live-dot" />
      <span>{t.agent.statusReady}</span>
      <span className="ob-live-separator" />
      <span>{STATUS_WORDS[idx]}</span>
    </div>
  );
}

// ── First Task Coach ──
// One-time onboarding banner for brand-new users with zero conversation
// history. Sits above the hero, points at a concrete example prompt, and
// disappears for good once the user either sends their first task or
// dismisses it. Keyed on localStorage so it never re-appears for the
// same browser profile.
const COACH_KEY = 'ob_first_task_coach_dismissed_v1';
const COACH_EXAMPLE_PROMPTS = [
  {
    icon: 'mail',
    label: '给客户写一封跟进邮件',
    desc: '语气专业、内容简短、带一个明确的 CTA',
    prompt: '帮我给客户写一封简短的跟进邮件,确认下周三的会议。语气专业友好,最后带一个明确的回复 CTA。',
  },
  {
    icon: 'doc',
    label: '把会议纪要变成 5 个行动项',
    desc: '每个行动项带 owner 和截止时间',
    prompt: '我给你一段会议纪要,帮我提炼出 5 个具体行动项,每个标注 owner 和建议的截止时间。会议内容:今天产品评审会讨论了 Q2 路线图,张三负责需求文档,李四负责设计评审,预计两周内完成...',
  },
  {
    icon: 'spark',
    label: '写一段产品发布文案',
    desc: '150 字以内,放朋友圈和微博能用',
    prompt: '帮我写一段 150 字以内的产品发布文案,重点突出"AI 帮你完成任务,你只负责审核"这个核心卖点,语气轻松有力,适合发朋友圈和微博。',
  },
];

function CoachIcon({ name }: { name: string }) {
  const s = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'mail') return <svg {...s}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
  if (name === 'doc') return <svg {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
  if (name === 'spark') return <svg {...s}><path d="M12 2v6m0 8v6M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M2 12h6m8 0h6M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24"/></svg>;
  if (name === 'close') return <svg {...s} strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>;
  return null;
}

interface FirstTaskCoachProps {
  onPickExample: (prompt: string) => void;
}

function FirstTaskCoach({ onPickExample }: FirstTaskCoachProps) {
  const [dismissed, setDismissed] = useState(true);
  // Only read localStorage after mount (SSR safety).
  useEffect(() => {
    try {
      const seen = localStorage.getItem(COACH_KEY);
      if (!seen) setDismissed(false);
    } catch {
      // localStorage unavailable (private mode, etc.) — just don't show.
    }
  }, []);
  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(COACH_KEY, '1'); } catch {}
  }
  function pick(prompt: string) {
    onPickExample(prompt);
    dismiss();
  }
  if (dismissed) return null;
  return (
    <div className="ob-first-task-coach">
      <button
        onClick={dismiss}
        aria-label={t.agent.coachDismiss}
        className="ob-coach-close-btn"
      >
        <CoachIcon name="close" />
      </button>

      <div className="ob-coach-kicker">{t.agent.coachKicker}</div>

      <div className="ob-coach-title">{t.agent.coachTitle}</div>
      <div className="ob-coach-subtitle">{t.agent.coachSubtitle}</div>

      <div className="ob-coach-grid">
        {COACH_EXAMPLE_PROMPTS.map((ex) => (
          <button
            key={ex.label}
            onClick={() => pick(ex.prompt)}
            className="ob-coach-example-btn"
          >
            <div className="ob-coach-example-head">
              <CoachIcon name={ex.icon} />
              <span className="ob-coach-example-label">{ex.label}</span>
            </div>
            <div className="ob-coach-example-desc">{ex.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
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
  if (name === 'spark') return <svg {...s}><path d="M12 2v6m0 8v6M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M2 12h6m8 0h6M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24"/></svg>;
  if (name === 'package') return <svg {...s}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
  if (name === 'activity') return <svg {...s}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
  if (name === 'settings') return <svg {...s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
  if (name === 'account') return <svg {...s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
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
  const [taskLoadError, setTaskLoadError] = useState(false);
  // Active AI colleague (skill role) for the current conversation.
  // null = plain agent mode. Pinned to the conversation server-side on
  // first task submit. Swapping mid-conversation updates the conversation.
  const [skillRoleId, setSkillRoleId] = useState<string | null>(null);
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
      // Reset skill role when leaving a conversation; when landing on a
      // new conversation, it'll be refilled from the convs list effect below.
      if (!urlConvId) setSkillRoleId(null);
    }
  }, [urlConvId]);

  // Sync skillRoleId when conversation list updates or current conversation
  // changes — read the stored role from the server's conversation record.
  useEffect(() => {
    if (!currentConversationId) {
      setSkillRoleId(null);
      return;
    }
    const conv = conversations.find(c => c.id === currentConversationId);
    if (conv) setSkillRoleId(conv.skillRoleId ?? null);
  }, [currentConversationId, conversations]);

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
    setTaskLoadError(false);
    fetch(`/api/conversations/${convId}/tasks`)
      .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json(); })
      .then(data => {
        if (Array.isArray(data)) {
          const parsed = data.map((d: Record<string, unknown>) => parseTaskFromAPI(d));
          setTasks(parsed);
          if (parsed.length > 0) {
            setActiveTaskId(parsed[parsed.length - 1].id);
          }
        } else {
          // Non-array response — treat as empty conversation
          setTasks([]);
          setTaskLoadError(true);
        }
      })
      .catch(() => {
        setTasks([]);
        setTaskLoadError(true);
      });
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
  // Uses router.replace instead of raw window.history.pushState so that
  // useSearchParams() re-reads and the URL-sync useEffect above fires.
  // Previously pushState updated the URL but left the React hook stale,
  // which could cause the state-sync effect to skip when the user
  // selected a conversation that happened to share an id prefix.
  async function handleNewChat() {
    setActiveTaskId(null);
    activeRef.current = null;
    setTasks([]);
    setTaskLoadError(false);
    setCurrentConversationId(null);
    currentConvRef.current = null;
    router.replace('/agent');
    setSidebarOpen(false);
  }

  // ── Handle conversation selection ──
  async function handleSelectConversation(convId: string) {
    if (convId === currentConvRef.current) { setSidebarOpen(false); return; }
    setActiveTaskId(null);
    activeRef.current = null;
    setTasks([]);
    setTaskLoadError(false);
    setCurrentConversationId(convId);
    currentConvRef.current = convId;
    window.history.pushState(null, '', `/agent?conversationId=${convId}`);
    setSidebarOpen(false);
  }

  // ── Handle task submission ──
  async function handleSubmit(input: string, type?: string, attachments?: { id: string; name: string; size: number; type: string }[]) {
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
        body: JSON.stringify({
          input,
          type,
          conversationId: convId,
          attachments: attachments || undefined,
          // Pin the currently-selected AI colleague to this task's conversation.
          // Runtime reads this + prepends the role's system prompt to input.
          skillRoleId: skillRoleId || undefined,
        }),
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
        let nt: TaskState;
        try {
          const dr = await fetch(`/api/tasks/${data.taskId}`);
          const dd = await dr.json();
          if (dd && !dd.error) { nt = parseTaskFromAPI(dd); }
          else { nt = { id: data.taskId, type: data.type || 'unknown', status: 'pending', title: input.slice(0, 50), input, source: 'agent', createdAt: now, updatedAt: now, events: [], eventsLoaded: false, currentInteraction: null, result: null, lastSeenUpdatedAt: now, context: {}, conversationId: convId || undefined }; }
        } catch {
          // Task fetch failed — use fallback task state
          nt = { id: data.taskId, type: data.type || 'unknown', status: 'pending', title: input.slice(0, 50), input, source: 'agent', createdAt: now, updatedAt: now, events: [], eventsLoaded: false, currentInteraction: null, result: null, lastSeenUpdatedAt: now, context: {}, conversationId: convId || undefined };
        }
        setTasks(prev => [...prev, nt]);
        setActiveTaskId(data.taskId);
        fetchQuota();
        fetchConversations();
      }
    } catch (e) { console.error(e); showError('提交失败'); } finally { setIsSubmitting(false); }
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

  if (!authChecked) return <div className="ob-agent-boot-placeholder" />;

  // ── Sidebar content ──
  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="ob-sidebar-brand">
        <div className="ob-sidebar-brand-title">
          <span className="ob-brand-accent">ORANGE</span>
          <span className="ob-brand-text">BENCH</span>
        </div>
        <div className="ob-sidebar-brand-sub">{t.agent.brandSub}</div>
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

      {/* Workspace quick links */}
      <div className="ob-sidebar-shortcuts">
        {[
          { href: '/tasks', label: '我的任务', iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
          { href: '/workspace', label: '团队工作区', iconPath: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
          { href: '/account/skills', label: '技能中心', iconPath: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
        ].map(item => (
          <a key={item.href} href={item.href} className="ob-sidebar-shortcut-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.iconPath} />
            </svg>
            <span>{item.label}</span>
          </a>
        ))}
      </div>

      {/* Conversation list grouped */}
      <div className="ob-sidebar-scroll custom-scrollbar">
        {conversationGroups.length > 0 ? (
          conversationGroups.map((group) => (
            <div key={group.label} className="ob-conversation-group">
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

      {/* Footer nav — 4 items, matches MAIN_NAV in lib/nav.ts.
          Previously had 6 hardcoded items duplicating the top nav,
          which created the IA confusion the PM audit called out:
          任务 / 总览 / 处理 all queried the same tasks, and
          设置 / 账户 were both user config. Now collapsed to the
          same 4 destinations as the desktop top nav. */}
      <div className="ob-sidebar-footer">
        {[
          { href: '/agent', icon: 'spark', label: 'AI协作' },
          { href: '/workspace', icon: 'dashboard', label: '团队空间' },
          { href: '/studio', icon: 'package', label: '设计工作室' },
          { href: '/cloud-browser', icon: 'activity', label: '云浏览器' },
          { href: '/account', icon: 'account', label: '应用中心' },
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
    <div className="agent-root">
      {reconnecting && (
        <div className="ob-reconnect agent-reconnect-banner">{t.agent.reconnecting}</div>
      )}

      <ProductShell
        hero={(
          <div className="ob-agent-shell-hero">
            <h1>{t.agent.title}</h1>
            <p>{t.agent.subtitle}</p>
          </div>
        )}
        sidebar={<div className="ob-agent-sidebar">{sidebarContent}</div>}
        rightRail={(
          <div className="ob-grid-gap">
            <Panel title={t.agent.taskStatus} description="当前执行链路">
              <StatusPill>{activeTask?.status || t.common.ready}</StatusPill>
              <p className="ob-panel-hint">{t.agent.taskStatusHint}</p>
            </Panel>
            <Panel title={t.agent.quickActions} description="一键发起常用任务">
              <div className="ob-chip-row">
                {QUICK_ACTIONS.map((a) => (
                  <ActionChip key={a.label}>{a.label}</ActionChip>
                ))}
              </div>
            </Panel>
            <Panel title={t.agent.collaboration} description="产品主导航保持一致">
              <div className="ob-chip-row">
                {QUICK_NAV.map((item) => (
                  <a key={item.href} href={item.href} className="ob-mini-link">{item.label}</a>
                ))}
              </div>
            </Panel>
          </div>
        )}
      >
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <>
            <div className="ob-sidebar-overlay agent-sidebar-overlay md:hidden" onClick={() => setSidebarOpen(false)} />
            <aside className="ob-sidebar-drawer agent-sidebar--mobile md:hidden">
              {sidebarContent}
            </aside>
          </>
        )}

        <main className="ob-main agent-main">
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
            <span className="agent-mobile-title">{t.agent.title}</span>
            <button
              onClick={handleNewChat}
              aria-label="新建对话"
              className="ob-agent-mobile-add"
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
              {/* Scrollable conversation — with chat atmosphere */}
              <div ref={scrollRef} className="ob-scroll agent-scroll custom-scrollbar ob-chat-atmosphere ob-chat-scroll" key={currentConversationId}>
                {/* Exec overlays — left vertical lines + right dot grid */}
                <div className="ob-exec-vlines" />
                <div className="ob-dotgrid ob-dotgrid--exec ob-exec-dotgrid-bottom" />
                <div className="ob-messages agent-content-wrap ob-chat-messages-layer">
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
                  onSubmit={(input, attachments) => {
                    const ci = activeTask?.currentInteraction;
                    if (ci && activeTask?.status === 'interacting' &&
                      (ci.type === 'text_input' || ci.type === 'confirm')) {
                      handleInteractionSubmit(ci.stepId, input);
                    } else {
                      handleSubmit(input, undefined, attachments);
                    }
                  }}
                  disabled={isSubmitting || interactingTaskId === activeTask?.id}
                  placeholder={
                    activeTask?.currentInteraction &&
                    activeTask?.status === 'interacting' &&
                    (activeTask.currentInteraction.type === 'text_input' || activeTask.currentInteraction.type === 'confirm')
                      ? t.agent.replyPlaceholder
                      : t.agent.continuePlaceholder
                  }
                  chatMode
                  skillRoleId={skillRoleId}
                  onSkillRoleChange={setSkillRoleId}
                />
                {isSubmitting && (
                  <div className="agent-submitting-hint">
                    <Spinner size="sm" />
                    <span>{t.agent.typing}</span>
                  </div>
                )}
              </div>
            </>
            ) : taskLoadError ? (
              <div className="ob-task-load-state">
                <p className="ob-task-load-error">{t.agent.loadFailed}</p>
                <button onClick={() => currentConversationId && fetchConversationTasks(currentConversationId)} className="ob-task-load-retry">{t.agent.retry}</button>
              </div>
            ) : (
              <div className="ob-task-load-state ob-task-load-state--loading">
                <Spinner size="sm" />
              </div>
            )
          ) : (
            /* ── Welcome: Task Launcher ── */
            <div className="ob-welcome agent-welcome ob-agent-welcome">
              {/* Atmosphere layer */}
              <div className="ob-hero-atmosphere" />
              {/* Full-page dot grid — separate div so it covers entire area */}
              <div className="ob-dotgrid ob-dotgrid--hero ob-agent-dotgrid" />

              <div className="ob-atmosphere-content ob-agent-atmosphere-content">

                {/* First Task Coach — only for brand-new users with zero
                    conversation history. Picks an example, prefills the
                    composer, self-dismisses to localStorage forever. */}
                {conversations.length === 0 && (
                  <FirstTaskCoach
                    onPickExample={(prompt) => {
                      handleSubmit(prompt, 'unknown');
                    }}
                  />
                )}

                {/* Status bar — ABOVE title per spec */}
                <div className="ob-agent-live-wrap"><LiveStatusCycle /></div>

                {/* Hero title */}
                <h1 className="ob-hero-title ob-agent-hero-title">
                  {t.agent.launcherTitle.split('，')[0]}，<span className="ob-hero-accent">{t.agent.launcherTitle.split('，')[1] || '推进到完成'}</span>
                </h1>
                {/* Subtitle — token-driven editorial mono kicker */}
                <p className="ob-agent-launcher-subtitle">{t.agent.launcherSubtitle}</p>

                {/* Task launcher input */}
                <div className="ob-launcher ob-launcher-atmosphere ob-agent-launcher">
                  <AgentInput
                    onSubmit={(input, attachments) => handleSubmit(input, undefined, attachments)}
                    disabled={isSubmitting}
                    placeholder={t.agent.launcherPlaceholder}
                    prominent
                    skillRoleId={skillRoleId}
                    onSkillRoleChange={setSkillRoleId}
                  />
                {isSubmitting && (
                  <div className="agent-submitting-hint">
                    <Spinner size="sm" />
                    <span>{t.agent.launching}</span>
                  </div>
                )}
                </div>

                {/* Quick actions grid — primary zone.
                    All 3 cards prefill the composer with a real prompt
                    and run the task in place. Clicking one never leaves
                    /agent. (Previously mixed href-jumps with prefill
                    actions — see the PM audit for why that broke the
                    mental model.) */}
                <div className="ob-actions">
                  {QUICK_ACTIONS.map((a, i) => (
                    <button
                      key={i}
                      onClick={() => a.action && handleSubmit(a.action, a.type)}
                      disabled={isSubmitting}
                      className="ob-action-card"
                    >
                      <div className="ob-action-icon">
                        <ActionIcon name={a.icon} />
                      </div>
                      <div className="ob-action-meta">
                        <div className="ob-action-label">{a.label}</div>
                        <div className="ob-action-desc">{a.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Secondary navigation row — clearly labeled as "jump
                    to another page". Small, understated, separated from
                    the primary action cards. Users who know what they
                    want can click through; users scanning the page
                    understand at a glance these are not AI prompts. */}
                <div className="ob-agent-nav-row">
                  <span className="ob-agent-nav-label">{t.agent.jumpLabel}</span>
                  {QUICK_NAV.map((n, i) => (
                    <span key={n.href} className="ob-agent-nav-item-wrap">
                      {i > 0 && (
                        <span className="ob-agent-nav-dot">·</span>
                      )}
                      <a
                        href={n.href}
                        className="ob-agent-nav-link"
                      >
                        {n.label}
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="7" y1="17" x2="17" y2="7" />
                          <polyline points="7 7 17 7 17 17" />
                        </svg>
                      </a>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </ProductShell>

      {/* Error toast */}
      {errorToast && (
        <div className="ob-toast agent-error-toast animate-flow-in">
          {errorToast}
        </div>
      )}
      {/* Success toast */}
      {successToast && (
        <div className={`ob-toast animate-flow-in ob-success-toast ${errorToast ? 'ob-success-toast--stacked' : ''}`}>
          {successToast}
        </div>
      )}
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={<div className="ob-agent-boot-placeholder" />}>
      <AgentPageInner />
    </Suspense>
  );
}

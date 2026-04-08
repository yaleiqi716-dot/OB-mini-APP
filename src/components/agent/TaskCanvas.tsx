'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { InteractionPanel } from './InteractionPanel';
import { Typewriter } from './Typewriter';
import { Interaction, ConfirmInteraction, ApprovalType } from '@/types/interaction';
import { TaskStatus } from '@/types/task';
import { TASK_TYPES } from '@/lib/constants';

// SVG icon renderer for ApprovalCard — no emoji
function ApprovalIcon({ name }: { name: string }) {
  const s = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'mail')  return <svg {...s}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
  if (name === 'chart') return <svg {...s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
  if (name === 'file')  return <svg {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
  return <svg {...s}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
}

interface TaskEvent {
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}

interface TaskCanvasProps {
  taskId: string;
  title: string;
  type: string;
  status: TaskStatus;
  input: string;
  events: TaskEvent[];
  currentInteraction: Interaction | null;
  onInteractionSubmit: (stepId: string, value: unknown) => void;
  onApprove: (approvalType: ApprovalType) => void;
  onReject: (approvalType: ApprovalType) => void;
  onAdjustStructure: () => void;
  onAdjustProposal: () => void;
  onReviseEmail: () => void;
  actionLoading: boolean;
  result: Record<string, unknown> | null;
  loading?: boolean;
  credits?: number | null;
  executionStrategy?: string;
  modelName?: string;
  onNewTask?: (prompt: string, type: string) => void;
}

// ---- Next-step suggestions by task type ----

const SUGGESTIONS: Record<string, { prompt: string; type: string; label: string }[]> = {
  email: [
    { prompt: '帮我再写一封跟进邮件', type: 'email', label: '写跟进邮件' },
    { prompt: '生成一个客户回复模板', type: 'email', label: '客户回复模板' },
    { prompt: '帮我做一份项目汇报PPT', type: 'ppt', label: '做项目汇报' },
  ],
  ppt: [
    { prompt: '帮我优化这个PPT的结构', type: 'ppt', label: '优化PPT结构' },
    { prompt: '根据这个PPT生成演讲稿', type: 'proposal', label: '生成演讲稿' },
    { prompt: '帮我写一封邮件发送这个方案', type: 'email', label: '写发送邮件' },
  ],
  proposal: [
    { prompt: '帮我做一份配套的演示文稿', type: 'ppt', label: '做配套PPT' },
    { prompt: '帮我写一封邮件发送这个方案', type: 'email', label: '写发送邮件' },
    { prompt: '帮我写一份执行计划', type: 'proposal', label: '写执行计划' },
  ],
  direct: [
    { prompt: '帮我写一封邮件', type: 'email', label: '写邮件' },
    { prompt: '帮我做一份演示文稿', type: 'ppt', label: '做PPT' },
  ],
};

function getApprovalType(interaction: Interaction | null): ApprovalType | null {
  if (!interaction) return null;
  if (interaction.type !== 'confirm') return null;
  if (interaction.stepId !== 'approval_gate') return null;
  const dd = (interaction as ConfirmInteraction).detailData;
  return (dd?.approvalType as ApprovalType) || null;
}

const TYPE_LABELS: Record<string, string> = {
  ppt: '演示文稿', email: '邮件', proposal: '方案',
  website: '网页', video: '视频', unknown: '任务',
};

// ---- Narrative language transforms ----
// Convert system/technical language to AI assistant voice

function humanizeThinking(text: string): string {
  const map: [RegExp, string][] = [
    [/^正在分析.*需求.*$/, '我先帮你梳理一下需求，接下来我会把结构先搭出来'],
    [/^正在分析.*主题.*受众.*$/, '我先帮你理清主题和受众，然后我来搭演示文稿的框架'],
    [/^正在分析.*场景.*收件人.*$/, '我先了解一下邮件场景，接下来我直接帮你起草'],
    [/^正在分析.*背景.*目标.*$/, '我先理解一下项目背景，接下来我会帮你把方案框架搭出来'],
    [/^正在规划.*结构.*逻辑.*$/, '结构我先给你搭出来，我们一起看一下，如果没问题我就继续往下生成内容'],
    [/^正在规划.*框架.*章节.*$/, '方案框架我已经想好了，先给你过一下，确认后我马上开始写详细内容'],
    [/^正在拆解.*逐页.*$/, '好的，我开始逐页帮你完善内容，每完成一页我会告诉你，我会持续推进'],
    [/^正在拆解.*逐章.*$/, '好的，我开始逐章帮你撰写，每完成一个章节我会推进到下一个'],
    [/^正在组织.*结构.*措辞.*$/, '我在帮你组织邮件内容，写好后给你过目，你可以直接确认或者让我改'],
    [/^正在理解.*修改.*调整.*$/, '好的，我理解了你的调整方向，马上帮你重新来一版'],
    [/^正在重新规划.*$/, '好的，我重新帮你规划一个结构，调整好后你再看看'],
  ];
  for (const [pattern, replacement] of map) {
    if (pattern.test(text)) return replacement;
  }
  if (text.startsWith('正在')) {
    return '我' + text.replace('正在', '在帮你') + '，接下来我会继续推进';
  }
  return text;
}

function humanizeStep(text: string, current?: number, total?: number): string {
  if (text.includes('已生成')) {
    const subject = text.replace('已生成', '').trim();
    const suffix = current !== undefined && total !== undefined && current < total
      ? '，我继续推进下一项'
      : '';
    return subject ? `${subject}，已经帮你整理好了${suffix}` : `已经帮你整理好了${suffix}`;
  }
  if (text.includes('已完成')) {
    const subject = text.replace('已完成', '').trim();
    const suffix = current !== undefined && total !== undefined && current < total
      ? '，我继续往下写'
      : '';
    return subject ? `${subject}，已经完成了${suffix}` : `已经完成了${suffix}`;
  }
  return text;
}

function humanizeStatusBar(status: TaskStatus, text: string | null): string | null {
  if (!text) return null;
  const progressMatch = text.match(/\((\d+)\/(\d+)\)/);
  if (progressMatch) {
    const cur = parseInt(progressMatch[1]);
    const tot = parseInt(progressMatch[2]);
    if (cur >= tot) return '最后收尾中，马上就好...';
    return `正在帮你写第 ${cur} 项，共 ${tot} 项，我会持续推进...`;
  }
  if (status === 'understanding') return '我在理解你的需求，接下来帮你搭框架...';
  if (status === 'executing') return '我在逐步帮你完成，持续推进中...';
  if (text.includes('正在')) return text.replace('正在', '我在帮你');
  return text;
}

// ---- Data extraction ----

function getProgress(events: TaskEvent[]): { current: number; total: number } | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'step_update' && typeof e.data.current === 'number' && typeof e.data.total === 'number') {
      return { current: e.data.current as number, total: e.data.total as number };
    }
  }
  return null;
}

function getRawStatusBarText(status: TaskStatus, events: TaskEvent[]): string | null {
  if (status !== 'understanding' && status !== 'executing' && status !== 'structuring') return null;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'step_update' && e.data.current && e.data.total) {
      return `${e.data.text || '生成中'} (${e.data.current}/${e.data.total})`;
    }
  }
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === 'log') return String(events[i].data.message || '');
  }
  return null;
}

function getCompletedSteps(events: TaskEvent[]): { key: string; text: string; current?: number; total?: number }[] {
  const map = new Map<string, TaskEvent>();
  for (const e of events) {
    if (e.type === 'step_update') map.set(String(e.data.step || ''), e);
  }
  return Array.from(map.values())
    .filter((e) => {
      const t = String(e.data.text || '');
      return t.includes('已生成') || t.includes('已完成');
    })
    .map((e) => {
      const cur = typeof e.data.current === 'number' ? (e.data.current as number) : undefined;
      const tot = typeof e.data.total === 'number' ? (e.data.total as number) : undefined;
      return {
        key: String(e.data.step || ''),
        text: humanizeStep(String(e.data.text || ''), cur, tot),
        current: cur,
        total: tot,
      };
    });
}

// ---- Phase-based thinking ----

interface ThinkingPhase {
  text: string;
  completed: boolean;
}

function buildThinkingPhases(events: TaskEvent[]): ThinkingPhase[] {
  const phases: ThinkingPhase[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (e.type === 'thinking') {
      const raw = String(e.data.text || '');
      if (raw && !seen.has(raw)) {
        seen.add(raw);
        phases.push({ text: humanizeThinking(raw), completed: false });
      }
    }
  }
  for (let i = 0; i < phases.length - 1; i++) {
    phases[i].completed = true;
  }
  return phases;
}

// ---- Execution Timeline (time-based, instant feedback) ----

const EXEC_PHASES = [
  { label: '思考中...', delay: 0 },
  { label: '正在调用 AI 模型...', delay: 1800 },
  { label: '生成中...', delay: 4000 },
];

function ExecutionTimeline({ status, events }: { status: TaskStatus; events: TaskEvent[] }) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const startRef = useRef(Date.now());

  useEffect(() => {
    // Reset when task starts
    startRef.current = Date.now();
    setPhaseIdx(0);
    setCompletedPhases([]);

    const timers: ReturnType<typeof setTimeout>[] = [];
    EXEC_PHASES.forEach((phase, i) => {
      if (i === 0) return;
      timers.push(setTimeout(() => {
        setCompletedPhases(prev => [...prev, i - 1]);
        setPhaseIdx(i);
      }, phase.delay));
    });
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Don't show if we already have real thinking events
  const hasRealThinking = events.some(e => e.type === 'thinking' || e.type === 'step_update' || e.type === 'log');
  if (hasRealThinking) return null;
  if (status === 'completed' || status === 'failed') return null;

  return (
    <div className="space-y-2">
      {EXEC_PHASES.map((phase, i) => {
        const isDone = completedPhases.includes(i);
        const isCurrent = phaseIdx === i;
        if (i > phaseIdx) return null; // not yet shown
        return (
          <div key={i} className={`flex items-center gap-2 text-xs transition-all duration-500 ${isDone ? 'text-content-tertiary/50' : 'text-content-secondary'}`}>
            {isDone ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-green-500/60 flex-shrink-0">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : isCurrent ? (
              <span className="w-2.5 h-2.5 rounded-full bg-accent/60 animate-pulse flex-shrink-0" />
            ) : null}
            <span className={isDone ? 'line-through' : isCurrent ? 'animate-progress-pulse' : ''}>{phase.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- Narrative mode ----

type NarrativeMode = 'interaction' | 'executing' | 'thinking' | 'result' | 'error' | 'blocked' | 'idle';

function getNarrativeMode(status: TaskStatus, isApproval: boolean, isGenericInteraction: boolean): NarrativeMode {
  if (status === 'completed') return 'result';
  if (status === 'blocked') return 'blocked';
  if (status === 'failed') return 'error';
  if (isApproval || isGenericInteraction) return 'interaction';
  if (status === 'executing') return 'executing';
  if (status === 'understanding' || status === 'structuring') return 'thinking';
  return 'idle';
}

// ---- Main component ----

export function TaskCanvas({
  taskId, title, type, status, input, events, currentInteraction,
  onInteractionSubmit, onApprove, onReject, onAdjustStructure, onAdjustProposal, onReviseEmail,
  actionLoading, result, loading, credits, executionStrategy, modelName, onNewTask,
}: TaskCanvasProps) {
  // Expose taskId to ResultContainer via context
  const taskIdRef = taskId;
  const prevTaskIdRef = useRef(taskId);
  if (taskId !== prevTaskIdRef.current) {
    prevTaskIdRef.current = taskId;
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-5 py-4 border-b border-border">
          <div className="h-4 w-48 rounded bg-surface-tertiary animate-pulse" />
          <div className="h-3 w-24 rounded bg-surface-tertiary animate-pulse mt-2" />
        </div>
        <div className="p-5 space-y-4">
          <div className="h-3 w-full rounded bg-surface-tertiary animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-surface-tertiary animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-surface-tertiary animate-pulse" />
        </div>
      </div>
    );
  }

  const structureEvent = events.findLast((e) => e.type === 'structure_generated');
  const isActive = !['completed', 'failed'].includes(status);
  const isExecuting = isActive && status === 'executing';

  const approvalType = getApprovalType(currentInteraction);
  const isApprovalGate = approvalType !== null && status === 'interacting';
  const isGenericInteraction = currentInteraction !== null && status === 'interacting' && !isApprovalGate;

  const mode = getNarrativeMode(status, isApprovalGate, isGenericInteraction);
  const typeInfo = TASK_TYPES.find((t) => t.value === type);
  const rawStatusBar = getRawStatusBarText(status, events);
  const statusBarText = humanizeStatusBar(status, rawStatusBar);
  const progress = isExecuting ? getProgress(events) : null;
  const completedSteps = getCompletedSteps(events);

  // ---- Continuous thinking stream ----
  // Single string that grows via Typewriter append mode.
  // Completed: all phases joined. Result/error: final line appended.
  const showThinking = mode === 'thinking' || mode === 'executing';
  const thinkingStream = (() => {
    if (!showThinking) return null;
    const phases = buildThinkingPhases(events);
    if (phases.length === 0) return null;
    return phases.map((p) => p.text).join('  ');
  })();
  const hasThinking = thinkingStream !== null;

  // Completion closing line (appended to stream when done)
  const isJustCompleted = status === 'completed' && events.some((e) => e.type === 'task_completed');
  const closingThinking = isJustCompleted
    ? (() => {
        const phases = buildThinkingPhases(events);
        if (phases.length === 0) return null;
        return phases.map((p) => p.text).join('  ') + '  好，这个我已经帮你全部完成了，你可以直接查看结果';
      })()
    : null;

  // Logs — only in result/error mode for review
  const allLogs = events.filter((e) => e.type === 'log');
  const phaseLogs = allLogs.filter((e) => {
    const msg = String(e.data.message || '');
    return msg.includes('正在理解') || msg.includes('正在识别') ||
           msg.includes('结构已') || msg.includes('正在生成') ||
           msg.includes('正在撰写') || msg.includes('已生成') ||
           msg.includes('已完成') || msg.includes('已确认') ||
           msg.includes('等待确认') || msg.includes('正在根据');
  });
  const visibleLogs = (() => {
    if (mode === 'result' || mode === 'error') return phaseLogs;
    return [];
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Pure chat flow — no header card */}
      <div className="flex-1 overflow-y-auto px-0 py-0">
        <div className="ob-messages agent-content-wrap" style={{ paddingBottom: 0 }}>

        {/* AI response area — user bubble is rendered by parent page */}
        {(events.length > 0 || isActive) ? (
          <div className="ob-msg-ai chat-ai-area">
            {/* AI avatar row */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-[#f97316]/10 flex items-center justify-center flex-shrink-0">
                {/* AI avatar icon — SVG, no emoji */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(224,216,208,0.28)' }}>ORANGEBENCH</span>
              {isActive ? (
                <span style={{ fontSize: 11, color: '#C2410C', fontWeight: 500, background: 'rgba(255,90,31,0.08)', padding: '2px 8px', borderRadius: 9999 }}>执行中</span>
              ) : mode === 'result' ? (
                <span style={{ fontSize: 11, color: '#047857', fontWeight: 500, background: 'rgba(16,185,129,0.08)', padding: '2px 8px', borderRadius: 9999 }}>已完成</span>
              ) : null}
            </div>

            {/* Mission phase indicator */}
            {isActive && (
              <div className="ob-mission-phase" style={{ marginLeft: 36 }}>
                <span className={`ob-mission-dot ${status === 'understanding' || status === 'structuring' ? 'ob-mission-dot--active' : status === 'executing' || status === 'completed' ? 'ob-mission-dot--done' : 'ob-mission-dot--active'}`} />
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: '#8A8078', letterSpacing: '1px', flexShrink: 0 }}>
                  {status === 'queued' || status === 'pending' ? 'READY' :
                   status === 'understanding' ? 'SIGNAL' :
                   status === 'structuring' ? 'PLAN' :
                   status === 'executing' ? 'RUNNING' :
                   status === 'interacting' ? 'WAIT' : 'LIVE'}
                </span>
                <span className="ob-mission-label" style={{ flex: 1 }}>
                  {status === 'queued' || status === 'pending' ? '准备启动' :
                   status === 'understanding' ? '理解任务需求' :
                   status === 'structuring' ? '整理执行方案' :
                   status === 'executing' ? '正在生成内容' :
                   status === 'interacting' ? '等待你的确认' :
                   '推进中'}
                </span>
                <span className="ob-mission-sub" style={{ fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: '1px', color: '#8A8078' }}>
                  {completedSteps.length > 0 ? `${completedSteps.length} DONE` : ''}
                </span>
              </div>
            )}

            <div className="flex-1 min-w-0 space-y-3 pl-9" style={{ fontSize: 14, color: '#525252', lineHeight: 1.65 }}>

              {/* Logs — only during review */}
              {visibleLogs.map((event, i) => (
                <div key={`log-${i}`} className="animate-flow-in text-sm text-content-tertiary leading-relaxed">
                  {String(event.data.message || '')}
                </div>
              ))}

              {/* Completed structure */}
              {structureEvent && (isExecuting || mode === 'result' || mode === 'error') ? (
                <div className="animate-flow-in">
                  <CompletedStructure structure={structureEvent.data.structure as string[]} />
                </div>
              ) : null}

              {/* Completed steps — lightweight step blocks */}
              {completedSteps.length > 0 ? (
                <div className="ob-steps-container animate-flow-in">
                  {completedSteps.map((step, i) => {
                    const isLast = i === completedSteps.length - 1;
                    const isDone = !isLast || mode === 'result';
                    return (
                      <div key={`step-${i}`} className={`ob-step-block ${isLast && !isDone ? 'ob-step-block--active' : ''}`}>
                        <span className={`ob-step-dot ${isDone ? 'ob-step-dot--done' : 'ob-step-dot--active'}`} />
                        <span className="ob-step-text">
                          {step.text}
                          {step.current !== undefined && step.total !== undefined ? (
                            <span style={{ color: 'rgba(224,216,208,0.55)', fontSize: 12, marginLeft: 6, fontVariantNumeric: 'tabular-nums' }}>{step.current}/{step.total}</span>
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* Continuous thinking stream — single Typewriter, never disappears */}
              {hasThinking && thinkingStream ? (
                <div className="pl-3 border-l-2 border-accent/15">
                  <p className="text-xs text-content-secondary/60 italic leading-relaxed">
                    <Typewriter text={thinkingStream} speed={20} />
                  </p>
                </div>
              ) : null}

              {/* Closing thinking — after completion */}
              {closingThinking && !hasThinking ? (
                <div className="pl-3 border-l-2 border-green-400/15">
                  <p className="text-xs text-content-secondary/50 italic leading-relaxed">
                    <Typewriter text={closingThinking} speed={15} />
                  </p>
                </div>
              ) : null}

              {/* Execution Timeline — instant feedback before real events arrive */}
              {(status === 'queued' || status === 'pending' || status === 'executing' || status === 'understanding') && (
                <ExecutionTimeline status={status} events={events} />
              )}

              {/* Queued / pending hint — only if no real events yet */}
              {(status === 'queued' || status === 'pending') && events.length <= 1 ? (
                <p className="text-xs text-content-secondary/60 italic animate-progress-pulse">
                  正在处理，请稍候...
                </p>
              ) : null}

              {/* Idle hint — executing but nothing from backend yet */}
              {mode === 'executing' && completedSteps.length === 0 && !hasThinking ? (
                <p className="text-xs text-content-secondary/50 italic animate-progress-pulse">
                  我在帮你完善内容，持续推进中...
                </p>
              ) : null}



              {/* Transition line before approval — context-specific */}
              {isApprovalGate && approvalType === 'send_email' ? (
                <p className="text-xs text-content-secondary/70 italic animate-flow-in">
                  邮件我已经帮你整理好了，你看一下内容，没问题的话我就帮你确认发送
                </p>
              ) : null}
              {isApprovalGate && (approvalType === 'use_structure' || approvalType === 'use_proposal_structure') ? (
                <p className="text-xs text-content-secondary/70 italic animate-flow-in">
                  结构我先帮你搭出来了，你看一下整体思路，如果没问题我就继续往下生成内容
                </p>
              ) : null}

              {/* Approval cards */}
              {isApprovalGate && approvalType === 'send_email' ? (
                <div className="animate-flow-in">
                  <ApprovalCard icon="mail" label="邮件预览" loading={actionLoading}
                    onApprove={() => onApprove('send_email')} approveLabel="确认发送" loadingLabel="发送中..."
                    onSecondary={onReviseEmail} secondaryLabel="继续修改"
                    onReject={() => onReject('send_email')}>
                    <EmailPreview interaction={currentInteraction as ConfirmInteraction} events={events} />
                  </ApprovalCard>
                </div>
              ) : null}

              {isApprovalGate && approvalType === 'use_structure' ? (
                <div className="animate-flow-in">
                  <ApprovalCard icon="chart" label="演示文稿结构" loading={actionLoading}
                    onApprove={() => onApprove('use_structure')} approveLabel="继续生成"
                    onSecondary={onAdjustStructure} secondaryLabel="调整结构"
                    onReject={() => onReject('use_structure')}>
                    <StructureList structure={((currentInteraction as ConfirmInteraction).detailData?.structure as string[]) || []} />
                  </ApprovalCard>
                </div>
              ) : null}

              {isApprovalGate && approvalType === 'use_proposal_structure' ? (
                <div className="animate-flow-in">
                  <ApprovalCard icon="file" label="方案结构" loading={actionLoading}
                    onApprove={() => onApprove('use_proposal_structure')} approveLabel="继续生成"
                    onSecondary={onAdjustProposal} secondaryLabel="调整结构"
                    onReject={() => onReject('use_proposal_structure')}>
                    <StructureList structure={((currentInteraction as ConfirmInteraction).detailData?.structure as string[]) || []} />
                  </ApprovalCard>
                </div>
              ) : null}

              {isGenericInteraction ? (
                <div className="animate-flow-in space-y-3">
                  {/* AI 质问—显示在聊天气泡里 */}
                  <p className="text-sm text-content-primary leading-relaxed">
                    {currentInteraction!.question}
                  </p>
                  {/* single_choice / yes_no — 行内 chip 选项，点击即提交 */}
                  {(currentInteraction!.type === 'single_choice') && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(currentInteraction as import('@/types/interaction').SingleChoiceInteraction).options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => onInteractionSubmit(currentInteraction!.stepId, opt.value)}
                          className="px-4 py-1.5 rounded-full border border-border text-sm text-content-primary hover:bg-surface-tertiary hover:border-accent transition-colors"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {(currentInteraction!.type === 'yes_no') && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => onInteractionSubmit(currentInteraction!.stepId, true)}
                        className="px-5 py-1.5 rounded-full border border-border text-sm text-content-primary hover:bg-surface-tertiary hover:border-accent transition-colors"
                      >是</button>
                      <button
                        onClick={() => onInteractionSubmit(currentInteraction!.stepId, false)}
                        className="px-5 py-1.5 rounded-full border border-border text-sm text-content-primary hover:bg-surface-tertiary hover:border-accent transition-colors"
                      >否</button>
                    </div>
                  )}
                  {/* text_input — 底部输入框会自动进入回复模式，无需额外提示 */}
                </div>
              ) : null}

              {mode === 'result' ? (
                <div className="animate-flow-in ob-result-node">
                  {result !== null && (result as Record<string, unknown>)?._preview === true ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <div className="max-h-36 overflow-hidden opacity-60">
                          <ResultView result={result} />
                        </div>
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent, var(--bg))' }} />
                      </div>
                      <div className="ob-error-hint">
                        <div className="ob-error-hint-icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        </div>
                        <div className="ob-error-hint-body">
                          <div className="ob-error-hint-title">内容已生成（预览）</div>
                          <div className="ob-error-hint-desc">解锁完整内容需 {Number((result as Record<string, unknown>)?._unlockCost) || 10} credits</div>
                          <button
                            onClick={() => {
                              fetch(`/api/tasks/${taskId}/unlock`, { method: 'POST' })
                                .then(r => r.json())
                                .then(d => { if (d.success) window.location.reload(); });
                            }}
                            className="ob-error-hint-retry"
                          >立即解锁</button>
                        </div>
                      </div>
                    </div>
                  ) : result !== null ? (
                    <ResultView result={result} taskId={taskIdRef} />
                  ) : null}
                  {/* Cost display */}
                  {(() => {
                    const costEvent = events.findLast((e) => e.type === 'task_completed' && typeof e.data.cost === 'number');
                    const cost = costEvent ? (costEvent.data.cost as number) : 0;
                    return cost > 0 ? (
                      <p className="text-[11px] text-content-tertiary mt-2">本次消耗 {cost} 额度</p>
                    ) : null;
                  })()}

                  {/* Result action buttons */}
                  <div className="ob-result-actions">
                    <button
                      onClick={() => onNewTask?.('帮我再优化一下这个结果', type)}
                      className="ob-result-action-btn"
                    >再优化一下</button>
                    <button
                      onClick={() => onNewTask?.('帮我换一种表达方式重新写', type)}
                      className="ob-result-action-btn"
                    >换一种表达</button>
                    <button
                      onClick={() => onNewTask?.('把上面的结果做成 PPT', 'ppt')}
                      className="ob-result-action-btn"
                    >做成 PPT</button>
                    <button
                      onClick={() => {
                        const el = document.querySelector('.ob-result-card-body');
                        const text = el?.textContent || '';
                        if (!text.trim()) return;
                        const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `orangebench-result-${taskId.slice(0, 8)}.md`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        const btn = document.activeElement as HTMLButtonElement;
                        if (btn) { const orig = btn.textContent; btn.textContent = '已下载'; setTimeout(() => { btn.textContent = orig; }, 1500); }
                      }}
                      className="ob-result-action-btn"
                    >导出</button>
                  </div>

                  {/* Next-step suggestions — server-driven with static fallback */}
                  {/* Action buttons are now rendered by parent result section above */}
                </div>
              ) : null}

              {/* Blocked — payment required */}
              {mode === 'blocked' ? (
                <div className="animate-flow-in ob-error-hint">
                  <div className="ob-error-hint-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </div>
                  <div className="ob-error-hint-body">
                    <div className="ob-error-hint-title">额度不足，任务已暂停</div>
                    <div className="ob-error-hint-desc">充值后任务将自动恢复执行</div>
                  </div>
                </div>
              ) : null}

              {mode === 'error' ? (() => {
                const errMsg = events.find((e) => e.type === 'error')
                  ? String(events.find((e) => e.type === 'error')!.data.message || '')
                  : '';
                const hasInsufficientEvent = events.some((e) => e.type === 'insufficient_credits');
                const isCreditsError = hasInsufficientEvent || errMsg.includes('余额不足') || errMsg.includes('额度不足');
                const isConfigError = errMsg.includes('API_KEY') || errMsg.includes('api_key') ||
                  errMsg.includes('OPENROUTER') || errMsg.includes('not configured') ||
                  errMsg.includes('未配置') || errMsg.includes('401') || errMsg.includes('403');
                const isImageError = errMsg.includes('LEONARDO') || errMsg.includes('leonardo');
                const isVideoError = errMsg.includes('MINIMAX') || errMsg.includes('minimax') || errMsg.includes('AKOOL') || errMsg.includes('akool');

                const friendlyMsg = isCreditsError
                  ? '额度不足，充值后任务会自动恢复'
                  : isImageError ? '图片生成功能暂未开启'
                  : isVideoError ? '视频生成功能暂未开启'
                  : isConfigError ? '当前能力暂不可用'
                  : (errMsg && !errMsg.includes('Error') && !errMsg.includes('error') && !errMsg.includes('API') && !errMsg.includes('KEY'))
                  ? errMsg : '当前能力暂不可用';
                const friendlyDesc = isCreditsError
                  ? '充值后任务将自动恢复执行'
                  : '请稍后重试，或联系管理员启用该能力';

                return (
                  <div className="animate-flow-in ob-error-hint">
                    <div className="ob-error-hint-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    </div>
                    <div className="ob-error-hint-body">
                      <div className="ob-error-hint-title">{friendlyMsg}</div>
                      <div className="ob-error-hint-desc">{friendlyDesc}</div>
                      {taskId && !isCreditsError && (
                        <button
                          onClick={() => {
                            fetch(`/api/tasks/${taskId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'queued' }),
                            })
                              .then(r => r.json())
                              .then(d => { if (d.success) window.location.reload(); });
                          }}
                          className="ob-error-hint-retry"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
                          重试
                        </button>
                      )}
                    </div>
                  </div>
                );
              })() : null}
            </div>
          </div>
        ) : null}

        </div>{/* end ob-messages */}
      </div>{/* end scroll area */}
    </div>
  );
}

// ---- Sub-components ----

function CompletedStructure({ structure }: { structure: string[] }) {
  return (
    <div className="pl-3 border-l-2 border-green-400/20 py-1">
      <div className="flex items-center gap-2 mb-1.5">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span className="text-xs text-content-tertiary">结构已确认 · {structure.length} 项</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {structure.map((item, i) => (
          <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-surface-tertiary/50 text-content-tertiary">{item}</span>
        ))}
      </div>
    </div>
  );
}

function ApprovalCard({
  icon, label, loading, children,
  onApprove, approveLabel, loadingLabel,
  onSecondary, secondaryLabel, onReject,
}: {
  icon: string; label: string; loading: boolean; children: React.ReactNode;
  onApprove: () => void; approveLabel: string; loadingLabel?: string;
  onSecondary?: () => void; secondaryLabel?: string; onReject: () => void;
}) {
  return (
    <div className="rounded-xl border border-accent/25 bg-accent/[0.03] p-5 space-y-4">
      <div className="flex items-center gap-2">
        {/* icon key → SVG, no emoji */}
        <ApprovalIcon name={icon} />
        <span className="text-accent text-sm font-medium">{label}</span>
      </div>
      {children}
      <div className="flex flex-wrap items-center gap-2 md:gap-3 pt-1">
        <Button onClick={onApprove} size="sm" disabled={loading}>
          {loading ? (loadingLabel || '处理中...') : approveLabel}
        </Button>
        {onSecondary && secondaryLabel ? (
          <Button onClick={onSecondary} variant="secondary" size="sm" disabled={loading}>{secondaryLabel}</Button>
        ) : null}
        <button onClick={onReject} disabled={loading} className="text-xs text-content-tertiary hover:text-content-secondary transition-colors disabled:opacity-50 md:ml-auto">
          重新生成
        </button>
      </div>
    </div>
  );
}

function EmailPreview({ interaction, events }: { interaction: ConfirmInteraction; events?: TaskEvent[] }) {
  const dd = interaction.detailData;
  const subject = (dd?.subject as string) || '';
  const body = (dd?.body as string) || interaction.detail || '';
  const hasRevision = events?.some((e) =>
    e.type === 'interaction_response' && (e.data.stepId === 'revise_email')
  );
  return (
    <div className="space-y-3">
      {hasRevision ? (
        <p className="text-[11px] text-accent">已根据你的反馈重新写了一版，你看看这次怎么样</p>
      ) : null}
      {subject ? (
        <div>
          <p className="text-[11px] text-content-tertiary mb-1">主题</p>
          <p className="text-sm font-medium text-content-primary">{subject}</p>
        </div>
      ) : null}
      <div>
        <p className="text-[11px] text-content-tertiary mb-1">正文</p>
        <div className="rounded-lg bg-surface-secondary border border-border p-4">
          <p className="text-sm text-content-secondary whitespace-pre-wrap leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}

function StructureList({ structure }: { structure: string[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-content-tertiary">共 {structure.length} 项</p>
      {structure.map((item, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-secondary border border-border">
          <span className="text-xs text-accent font-mono w-5 text-center">{i + 1}</span>
          <span className="text-sm text-content-primary">{item}</span>
        </div>
      ))}
    </div>
  );
}

function ResultView({ result, taskId: rvTaskId }: { result: Record<string, unknown>; taskId?: string }) {
  const data = result;
  const resultType = data.type as string;

  if (resultType === 'ppt' && data.slides) {
    const slides = data.slides as { index: number; title: string; content: string[]; notes: string }[];
    return (
      <ResultContainer title="演示文稿已经帮你整理好了，你看一下" subtitle={`共 ${slides.length} 页`} taskId={rvTaskId}>
        {slides.map((slide) => (
          <div key={slide.index} className="p-4 rounded-lg bg-surface-tertiary border border-border">
            <p className="text-sm font-medium text-content-primary mb-2">第 {slide.index + 1} 页：{slide.title}</p>
            <ul className="space-y-1.5">
              {slide.content.map((item, i) => (
                <li key={i} className="text-xs text-content-secondary flex gap-2 leading-relaxed"><span className="text-accent">·</span>{item}</li>
              ))}
            </ul>
            {slide.notes ? <p className="mt-2 text-xs text-content-tertiary italic">备注：{slide.notes}</p> : null}
          </div>
        ))}
      </ResultContainer>
    );
  }

  if (resultType === 'email' && data.content) {
    const email = data.content as { subject: string; body: string };
    return (
      <ResultContainer title="邮件已经帮你准备好了，随时可以发送" taskId={rvTaskId}>
        <div className="p-4 rounded-lg bg-surface-tertiary border border-border">
          <p className="text-sm font-medium text-content-primary mb-3">主题：{email.subject}</p>
          <p className="text-sm text-content-secondary whitespace-pre-wrap leading-relaxed">{email.body}</p>
        </div>
      </ResultContainer>
    );
  }

  if (resultType === 'proposal') {
    const sections = data.sections as { heading: string; content: string }[] | undefined;
    const proposalTitle = (data.title as string) || '策划方案';
    const summary = data.summary as string | undefined;
    return (
      <ResultContainer title="方案已经帮你写好了，你看看内容" subtitle={summary} taskId={rvTaskId}>
        <p className="text-sm font-medium text-content-primary px-1">{proposalTitle}</p>
        {sections?.map((s, i) => (
          <div key={i} className="p-4 rounded-lg bg-surface-tertiary border border-border">
            <p className="text-sm font-medium text-accent mb-2">{s.heading}</p>
            <p className="text-sm text-content-secondary whitespace-pre-wrap leading-relaxed">{s.content}</p>
          </div>
        ))}
      </ResultContainer>
    );
  }

  if (resultType === 'agent_loop') {
    const history = data.history as { action: string; result: string }[] | undefined;
    const summary = data.summary as string || '已完成';
    return (
      <ResultContainer title={summary} subtitle={`${data.iterations || 0} 轮推进`} taskId={rvTaskId}>
        {history && history.length > 0 ? (
          <div className="space-y-1.5">
            {history.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-content-secondary">
                <span className="text-accent flex-shrink-0">→</span>
                <span>{h.action}: {h.result}</span>
              </div>
            ))}
          </div>
        ) : null}
      </ResultContainer>
    );
  }

  if (resultType === 'orchestrator' && data.plan) {
    const plan = data.plan as { type: string; input: string }[];
    return (
      <ResultContainer title="已帮你拆解并分发任务" subtitle={`共 ${plan.length} 个子任务`} taskId={rvTaskId}>
        <div className="space-y-2">
          {plan.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-content-secondary">
              <span className="text-accent">→</span>
              <span className="font-medium text-content-primary">{t.type}</span>
              <span className="truncate">{t.input}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-content-tertiary mt-2">子任务已自动创建并开始执行，可在左侧查看</p>
      </ResultContainer>
    );
  }

  if (resultType === 'text' || (resultType === undefined && data.text)) {
    const textContent = (data.text || data.content || data.message) as string;
    return (
      <ResultContainer title="已帮你完成，你看一下" taskId={rvTaskId}>
        <div className="p-4 rounded-lg bg-surface-tertiary border border-border">
          <p className="text-sm text-content-secondary whitespace-pre-wrap leading-relaxed">{textContent}</p>
        </div>
      </ResultContainer>
    );
  }
  if (resultType === 'direct' && data.content) {
    return (
      <ResultContainer title="已经帮你完成了，你看一下结果" taskId={rvTaskId}>
        <div className="p-4 rounded-lg bg-surface-tertiary border border-border">
          <p className="text-sm text-content-secondary whitespace-pre-wrap leading-relaxed">{data.content as string}</p>
        </div>
      </ResultContainer>
    );
  }

  // Image result — Leonardo / any image tool
  if (resultType === 'image' || data.imageUrl || data.image_url) {
    const imgUrl = (data.imageUrl || data.image_url || data.url) as string;
    const imgList = (data.images as string[]) || (imgUrl ? [imgUrl] : []);
    return (
      <ResultContainer title="我帮你生成了这张图，你可以直接使用或告诉我调整方向" taskId={rvTaskId}>
        <div className="grid gap-3" style={{ gridTemplateColumns: imgList.length > 1 ? 'repeat(2, 1fr)' : '1fr' }}>
          {imgList.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              className="block rounded-xl overflow-hidden border border-border hover:opacity-90 transition-opacity">
              <img src={url} alt={`生成图片 ${i + 1}`} className="w-full h-auto object-cover" loading="lazy" />
            </a>
          ))}
          {imgList.length === 0 && (
            <p className="text-sm text-content-tertiary">图片链接暂时不可用</p>
          )}
        </div>
        {imgList.length > 0 && (
          <a href={imgList[0]} target="_blank" rel="noopener noreferrer"
            className="text-xs text-accent hover:underline mt-1 inline-block">在新标签页打开原图</a>
        )}
      </ResultContainer>
    );
  }
  // Video result — Minimax / Akool / any video tool
  if (resultType === 'video' || data.videoUrl || data.video_url) {
    const vidUrl = (data.videoUrl || data.video_url || data.url) as string;
    const coverUrl = (data.coverUrl || data.cover_url || data.thumbnail) as string | undefined;
    return (
      <ResultContainer title="视频已经生成好了，适合直接用于内容发布或演示，你看一下效果" taskId={rvTaskId}>
        {vidUrl ? (
          <div className="rounded-xl overflow-hidden border border-border bg-surface-tertiary">
            <video src={vidUrl} poster={coverUrl} controls preload="metadata"
              className="w-full max-h-[360px] object-contain" />
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-content-tertiary">视频已生成</span>
              <a href={vidUrl} target="_blank" rel="noopener noreferrer" download
                className="text-xs text-accent hover:underline">下载视频</a>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-surface-tertiary border border-border text-sm text-content-tertiary">
            视频链接暂时不可用，请稍后刷新查看
          </div>
        )}
      </ResultContainer>
    );
  }
  // Fallback — friendly message, not raw JSON
  const fallbackContent = (data.content || data.summary || data.text || data.message) as string | undefined;
  return (
    <ResultContainer title="已经帮你完成了，你看一下结果" taskId={rvTaskId}>
      <div className="p-4 rounded-lg bg-surface-tertiary border border-border">
        <p className="text-sm text-content-secondary whitespace-pre-wrap leading-relaxed">
          {fallbackContent || '任务已完成，但结果格式暂不支持直接展示。'}
        </p>
      </div>
    </ResultContainer>
  );
}

function ResultContainer({ title, subtitle, children, taskId: rcTaskId }: { title: string; subtitle?: string; children: React.ReactNode; taskId?: string }) {
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const handleCopy = useCallback(() => {
    const text = contentRef.current?.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);
  return (
    <div className="ob-result-card animate-flow-in">
      {/* Result header — white card top bar */}
      <div className="ob-result-card-header">
        <div className="flex items-center gap-2">
          <span style={{ display: 'inline-flex', width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 600, color: '#22c55e', textTransform: 'uppercase' as const, letterSpacing: '1.5px' }}>RESULT</span>
          {subtitle && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{subtitle}</span>}
        </div>
        <button
          onClick={handleCopy}
          aria-label="复制内容"
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, fontSize: 11, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background .2s ease' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {copied ? (
            <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span style={{ color: '#22c55e' }}>已复制</span></>
          ) : (
            <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>复制</span></>
          )}
        </button>
      </div>
      {/* Result body */}
      <div className="ob-result-card-body">
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 16 }}>{title}</p>
        <div className="ob-result-card-inner" style={{ color: 'rgba(224,216,208,0.55)', lineHeight: 1.75 }}>
          <div className="space-y-3" ref={contentRef}>{children}</div>
        </div>
      </div>
    </div>
  );
}

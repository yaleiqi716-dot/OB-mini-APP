'use client';

import { useRef } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { InteractionPanel } from './InteractionPanel';
import { Typewriter } from './Typewriter';
import { Interaction, ConfirmInteraction, ApprovalType } from '@/types/interaction';
import { TaskStatus } from '@/types/task';
import { TASK_TYPES } from '@/lib/constants';

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
      {/* Header — light, not system-like */}
      <div className="px-4 md:px-5 py-3 md:py-3.5 border-b border-border/40">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base flex-shrink-0">{typeInfo?.icon || '📎'}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-content-primary truncate">{title || '新任务'}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge status={status} />
              <span className="text-xs text-content-tertiary">{TYPE_LABELS[type] || type}</span>
            </div>
          </div>
        </div>

        {statusBarText && (mode === 'executing' || mode === 'thinking') ? (
          <div className="mt-3 animate-flow-in">
            <div className="flex items-center gap-2 text-xs text-content-secondary">
              <Spinner size="sm" />
              <span className="animate-progress-pulse">{statusBarText}</span>
            </div>
            {progress ? (
              <div className="mt-2 h-1 rounded-full bg-surface-tertiary overflow-hidden">
                <div className="h-full rounded-full bg-accent progress-bar-fill"
                  style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Execution flow */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">

        {/* User input */}
        {input ? (
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-accent font-medium">你</span>
            </div>
            <div className="pt-1">
              <p className="text-sm text-content-primary leading-relaxed">{input}</p>
            </div>
          </div>
        ) : null}

        {/* AI response */}
        {(events.length > 0 || isActive) ? (
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-surface-tertiary flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-content-tertiary font-medium">{typeInfo?.icon || 'AI'}</span>
            </div>
            <div className="flex-1 min-w-0 space-y-3 pt-1">

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

              {/* Completed steps — action feed (brighter than thinking) */}
              {completedSteps.length > 0 ? (
                <div className="space-y-2 animate-flow-in">
                  {completedSteps.map((step, i) => (
                    <div key={`step-${i}`} className="flex items-start gap-2 text-[13px] text-content-primary leading-relaxed">
                      <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                      <span className="flex-1">{step.text}</span>
                      {step.current !== undefined && step.total !== undefined ? (
                        <span className="text-content-tertiary text-xs tabular-nums flex-shrink-0 mt-0.5">{step.current}/{step.total}</span>
                      ) : null}
                    </div>
                  ))}
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

              {/* Queued hint */}
              {status === 'queued' ? (
                <p className="text-xs text-content-secondary/60 italic animate-progress-pulse">
                  任务已提交，排队等待处理...
                </p>
              ) : null}

              {/* Idle hint — executing but nothing from backend yet */}
              {mode === 'executing' && completedSteps.length === 0 && !hasThinking ? (
                <p className="text-xs text-content-secondary/50 italic animate-progress-pulse">
                  我在帮你完善内容，持续推进中...
                </p>
              ) : null}

              {/* Pending hint */}
              {status === 'pending' && events.length <= 1 ? (
                <p className="text-xs text-content-secondary/50 italic animate-progress-pulse">
                  收到，我马上开始...
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
                  <ApprovalCard icon="✉️" label="邮件预览" loading={actionLoading}
                    onApprove={() => onApprove('send_email')} approveLabel="确认发送" loadingLabel="发送中..."
                    onSecondary={onReviseEmail} secondaryLabel="继续修改"
                    onReject={() => onReject('send_email')}>
                    <EmailPreview interaction={currentInteraction as ConfirmInteraction} events={events} />
                  </ApprovalCard>
                </div>
              ) : null}

              {isApprovalGate && approvalType === 'use_structure' ? (
                <div className="animate-flow-in">
                  <ApprovalCard icon="📊" label="演示文稿结构" loading={actionLoading}
                    onApprove={() => onApprove('use_structure')} approveLabel="继续生成"
                    onSecondary={onAdjustStructure} secondaryLabel="调整结构"
                    onReject={() => onReject('use_structure')}>
                    <StructureList structure={((currentInteraction as ConfirmInteraction).detailData?.structure as string[]) || []} />
                  </ApprovalCard>
                </div>
              ) : null}

              {isApprovalGate && approvalType === 'use_proposal_structure' ? (
                <div className="animate-flow-in">
                  <ApprovalCard icon="📋" label="方案结构" loading={actionLoading}
                    onApprove={() => onApprove('use_proposal_structure')} approveLabel="继续生成"
                    onSecondary={onAdjustProposal} secondaryLabel="调整结构"
                    onReject={() => onReject('use_proposal_structure')}>
                    <StructureList structure={((currentInteraction as ConfirmInteraction).detailData?.structure as string[]) || []} />
                  </ApprovalCard>
                </div>
              ) : null}

              {isGenericInteraction ? (
                <div className="animate-flow-in p-4 rounded-xl border border-accent/20 bg-accent/5">
                  <InteractionPanel interaction={currentInteraction!} onSubmit={onInteractionSubmit} />
                </div>
              ) : null}

              {mode === 'result' ? (
                <div className="animate-flow-in">
                  {result !== null && (result as Record<string, unknown>)?._preview === true ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <div className="max-h-36 overflow-hidden opacity-60">
                          <ResultView result={result} />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface-primary" />
                      </div>
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🔒</span>
                          <p className="text-sm font-medium text-amber-400">内容已生成（预览）</p>
                        </div>
                        <p className="text-xs text-content-tertiary">
                          解锁完整内容需 {Number((result as Record<string, unknown>)?._unlockCost) || 10} credits
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              fetch(`/api/tasks/${taskId}/unlock`, { method: 'POST' })
                                .then(r => r.json())
                                .then(d => {
                                  if (d.success) window.location.reload();
                                  else if (d.required) window.location.href = '/billing';
                                });
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
                          >
                            立即解锁（{Number((result as Record<string, unknown>)?._unlockCost) || 10} credits）
                          </button>
                          <a href="/billing" className="text-xs px-3 py-1.5 rounded-lg border border-accent text-accent hover:bg-accent/10 transition-colors">
                            去充值
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : result !== null ? (
                    <ResultView result={result} />
                  ) : (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 text-sm">✓</span>
                        <span className="text-sm font-medium text-green-400">任务已完成</span>
                      </div>
                    </div>
                  )}
                  {/* Cost display */}
                  {(() => {
                    const costEvent = events.findLast((e) => e.type === 'task_completed' && typeof e.data.cost === 'number');
                    const cost = costEvent ? (costEvent.data.cost as number) : 0;
                    return cost > 0 ? (
                      <p className="text-[11px] text-content-tertiary mt-2">本次消耗 {cost} 额度</p>
                    ) : null;
                  })()}

                  {/* Review actions */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => fetch(`/api/tasks/${taskId}/review`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'feedback' }),
                      })}
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-border bg-surface-secondary hover:bg-surface-tertiary text-content-secondary transition-all"
                    >
                      让员工修改
                    </button>
                    <button
                      onClick={() => fetch(`/api/tasks/${taskId}/review`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'ai_optimize' }),
                      }).then(() => window.location.reload())}
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-accent/30 bg-accent/5 hover:bg-accent/10 text-accent transition-all"
                    >
                      AI帮我优化
                    </button>
                    <button
                      onClick={() => fetch(`/api/tasks/${taskId}/review`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'approve' }),
                      })}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all"
                    >
                      通过
                    </button>
                  </div>

                  {/* Next-step suggestions — server-driven with static fallback */}
                  {onNewTask ? (() => {
                    // Prefer server-driven suggestions from event
                    const sugEvent = events.findLast((e) => e.type === 'next_suggestions');
                    const serverSugs = sugEvent?.data?.suggestions as { label: string; prompt: string; type: string; cost?: number }[] | undefined;
                    const resultType = (result?.type as string) || type;
                    const suggestions = serverSugs || SUGGESTIONS[resultType] || SUGGESTIONS.direct || [];
                    return suggestions.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs text-content-tertiary">你还可以继续：</p>
                        <div className="flex flex-wrap gap-2">
                          {suggestions.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => onNewTask(s.prompt, s.type)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-border bg-surface-secondary hover:bg-surface-tertiary hover:border-accent/30 text-content-primary transition-all flex items-center gap-1.5"
                            >
                              {s.label}
                              {'cost' in s && typeof s.cost === 'number' ? (
                                <span className="text-accent font-medium">-{s.cost}</span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })() : null}
                </div>
              ) : null}

              {/* Blocked — payment required */}
              {mode === 'blocked' ? (() => {
                const payEvent = events.findLast((e) => e.type === 'payment_required');
                const required = payEvent ? (payEvent.data.required as number) : 0;
                const current = payEvent ? (payEvent.data.current as number) : 0;
                return (
                  <div className="animate-flow-in p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                    <p className="text-sm font-medium text-amber-400">余额不足，任务已暂停</p>
                    {required > 0 ? (
                      <div className="text-xs text-content-tertiary space-y-1">
                        <p>需要 <span className="text-amber-400 font-medium">{required}</span> credits</p>
                        <p>当前余额 <span className="text-red-400 font-medium">{current}</span></p>
                      </div>
                    ) : null}
                    <p className="text-xs text-content-tertiary">充值后任务将自动恢复执行</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href="/billing" className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors">
                        充值 ¥19（100 credits）
                      </a>
                      <a href="/billing" className="text-xs px-3 py-1.5 rounded-lg border border-accent text-accent hover:bg-accent/10 transition-colors">
                        充值 ¥79（500 credits）
                      </a>
                    </div>
                  </div>
                );
              })() : null}

              {mode === 'error' ? (() => {
                const errMsg = events.find((e) => e.type === 'error')
                  ? String(events.find((e) => e.type === 'error')!.data.message || '')
                  : '';
                const hasInsufficientEvent = events.some((e) => e.type === 'insufficient_credits');
                const isCreditsError = hasInsufficientEvent || errMsg.includes('余额不足') || errMsg.includes('额度不足');

                return isCreditsError ? (
                  <div className="animate-flow-in p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                    <p className="text-sm text-amber-400">余额不足，任务已暂停</p>
                    <p className="text-xs text-content-tertiary">充值后任务将自动恢复执行</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href="/billing" className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors">
                        充值 ¥19（100 credits）
                      </a>
                      <a href="/billing" className="text-xs px-3 py-1.5 rounded-lg border border-accent text-accent hover:bg-accent/10 transition-colors">
                        充值 ¥79（500 credits）
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="animate-flow-in p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-400">
                      {errMsg || '遇到了一些问题，如果需要我可以重新试一下'}
                    </p>
                  </div>
                );
              })() : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---- Sub-components ----

function CompletedStructure({ structure }: { structure: string[] }) {
  return (
    <div className="pl-3 border-l-2 border-green-400/20 py-1">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-green-400 text-xs">✓</span>
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
        <span className="text-sm">{icon}</span>
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

function ResultView({ result }: { result: Record<string, unknown> }) {
  const data = result;
  const resultType = data.type as string;

  if (resultType === 'ppt' && data.slides) {
    const slides = data.slides as { index: number; title: string; content: string[]; notes: string }[];
    return (
      <ResultContainer title="演示文稿已经帮你整理好了，你看一下" subtitle={`共 ${slides.length} 页`}>
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
      <ResultContainer title="邮件已经帮你准备好了，随时可以发送">
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
      <ResultContainer title="方案已经帮你写好了，你看看内容" subtitle={summary}>
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
      <ResultContainer title={summary} subtitle={`${data.iterations || 0} 轮推进`}>
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
      <ResultContainer title="已帮你拆解并分发任务" subtitle={`共 ${plan.length} 个子任务`}>
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

  if (resultType === 'direct' && data.content) {
    return (
      <ResultContainer title="已经帮你完成了，你看一下结果">
        <div className="p-4 rounded-lg bg-surface-tertiary border border-border">
          <p className="text-sm text-content-secondary whitespace-pre-wrap leading-relaxed">{data.content as string}</p>
        </div>
      </ResultContainer>
    );
  }

  return (
    <ResultContainer title="已经帮你完成了，你看一下结果">
      <div className="p-4 rounded-lg bg-surface-tertiary border border-border">
        <pre className="text-xs text-content-secondary whitespace-pre-wrap font-sans">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </ResultContainer>
  );
}

function ResultContainer({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-2">
        <span className="text-green-400 text-sm">✓</span>
        <span className="text-sm font-medium text-green-400">{title}</span>
        {subtitle ? <span className="text-xs text-content-tertiary">{subtitle}</span> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

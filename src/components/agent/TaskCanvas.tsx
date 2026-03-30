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
}

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

type NarrativeMode = 'interaction' | 'executing' | 'thinking' | 'result' | 'error' | 'idle';

function getNarrativeMode(status: TaskStatus, isApproval: boolean, isGenericInteraction: boolean): NarrativeMode {
  if (status === 'completed') return 'result';
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
  actionLoading, result, loading,
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

  const showThinking = mode === 'thinking' || mode === 'executing';
  const thinkingPhases = showThinking ? buildThinkingPhases(events) : [];
  const hasThinking = thinkingPhases.length > 0;

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
      {/* Header */}
      <div className="px-4 md:px-5 py-3 md:py-3.5 border-b border-border">
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

              {/* Phase-based thinking */}
              {/* Thinking — background planning layer (dimmer than steps) */}
              {hasThinking ? (
                <div className="rounded-lg bg-surface-tertiary/40 border-l-2 border-accent/20 py-2 px-3 space-y-1">
                  {thinkingPhases.map((phase, i) =>
                    phase.completed ? (
                      <p key={i} className="text-[11px] text-content-tertiary/50 italic leading-relaxed">
                        {phase.text}
                      </p>
                    ) : (
                      <p key={i} className="text-xs text-content-secondary/70 italic leading-relaxed">
                        <Typewriter text={phase.text} speed={20} />
                      </p>
                    )
                  )}
                </div>
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

              {mode === 'result' && result !== null ? (
                <div className="animate-flow-in"><ResultView result={result} /></div>
              ) : null}

              {mode === 'error' ? (
                <div className="animate-flow-in p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">
                    {events.find((e) => e.type === 'error')
                      ? String(events.find((e) => e.type === 'error')!.data.message || '遇到了一些问题，如果需要我可以重新试一下')
                      : '遇到了一些问题，如果需要我可以重新试一下'}
                  </p>
                </div>
              ) : null}
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
    <div className="rounded-lg border border-border bg-surface-secondary/50 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-green-400 text-xs">✓</span>
        <span className="text-xs text-content-secondary">结构已确认</span>
        <span className="text-[11px] text-content-tertiary">共 {structure.length} 项</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {structure.map((item, i) => (
          <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-surface-tertiary text-content-tertiary border border-border">{item}</span>
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

'use client';

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

// Derive current status text from events
function getCurrentPhaseText(status: TaskStatus, events: TaskEvent[]): string | null {
  if (status === 'completed' || status === 'failed') return null;

  // Find latest step_update with progress
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'step_update' && e.data.current && e.data.total) {
      return `${e.data.text || '生成中'} (${e.data.current}/${e.data.total})`;
    }
  }

  // Fall back to latest log
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'log') return String(e.data.message || '');
  }

  if (status === 'understanding') return '正在理解需求...';
  if (status === 'executing') return '正在执行...';
  if (status === 'interacting') return '等待确认';
  if (status === 'structuring') return '等待确认结构';
  return null;
}

// Deduplicate step_updates: only keep the latest per step key
function getLatestStepUpdates(events: TaskEvent[]): TaskEvent[] {
  const map = new Map<string, TaskEvent>();
  for (const e of events) {
    if (e.type === 'step_update') {
      const key = String(e.data.step || '');
      map.set(key, e);
    }
  }
  return Array.from(map.values());
}

// Get progress from latest step_update
function getProgress(events: TaskEvent[]): { current: number; total: number } | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'step_update' && typeof e.data.current === 'number' && typeof e.data.total === 'number') {
      return { current: e.data.current as number, total: e.data.total as number };
    }
  }
  return null;
}

export function TaskCanvas({
  taskId, title, type, status, input, events, currentInteraction,
  onInteractionSubmit, onApprove, onReject, onAdjustStructure, onAdjustProposal, onReviseEmail,
  actionLoading, result,
}: TaskCanvasProps) {
  const structureEvent = events.findLast((e) => e.type === 'structure_generated');
  const isActive = !['completed', 'failed'].includes(status);
  const isExecuting = isActive && status === 'executing';

  const approvalType = getApprovalType(currentInteraction);
  const isApprovalGate = approvalType !== null && status === 'interacting';
  const isGenericInteraction = currentInteraction !== null && status === 'interacting' && !isApprovalGate;

  const typeInfo = TASK_TYPES.find((t) => t.value === type);
  const phaseText = getCurrentPhaseText(status, events);
  const progress = isExecuting ? getProgress(events) : null;
  const deduplicatedSteps = getLatestStepUpdates(events);

  // Only show completed steps (text ends with "已生成" or "已完成")
  const completedSteps = deduplicatedSteps.filter((e) => {
    const text = String(e.data.text || '');
    return text.includes('已生成') || text.includes('已完成');
  });

  // Get latest thinking event — only show when task is actively working
  const latestThinking = isActive
    ? (() => {
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].type === 'thinking') return String(events[i].data.text || '');
        }
        return null;
      })()
    : null;

  // Thinking is "live" if it's the most recent non-status event
  const isThinkingLive = latestThinking && isActive && (status === 'understanding' || status === 'executing' || status === 'structuring');

  return (
    <div className="flex flex-col h-full">
      {/* Header with live status */}
      <div className="px-5 py-3.5 border-b border-border">
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

        {/* Live status bar */}
        {phaseText && isActive ? (
          <div className="mt-3 animate-flow-in">
            <div className="flex items-center gap-2 text-xs text-content-secondary">
              <Spinner size="sm" />
              <span className="animate-progress-pulse">{phaseText}</span>
            </div>
            {progress ? (
              <div className="mt-2 h-1 rounded-full bg-surface-tertiary overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent progress-bar-fill"
                  style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Execution flow */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* User input as conversation starter */}
        {input ? (
          <div className="flex gap-3 animate-flow-in">
            <div className="h-7 w-7 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-accent font-medium">你</span>
            </div>
            <div className="pt-1">
              <p className="text-sm text-content-primary leading-relaxed">{input}</p>
            </div>
          </div>
        ) : null}

        {/* AI execution section */}
        {events.length > 0 ? (
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-surface-tertiary flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-content-tertiary font-medium">{typeInfo?.icon || 'AI'}</span>
            </div>
            <div className="flex-1 min-w-0 space-y-3 pt-1">

              {/* Activity log — dimmed when thinking is active */}
              {(() => {
                const logs = events.filter((e) => e.type === 'log');
                const showLogs = isApprovalGate || !isActive ? logs : logs.slice(-2);
                return showLogs.map((event, i) => (
                  <div key={`log-${i}`} className={`animate-flow-in text-sm leading-relaxed ${isThinkingLive ? 'text-content-tertiary' : 'text-content-secondary'}`}>
                    {String(event.data.message || '')}
                  </div>
                ));
              })()}

              {/* Thinking layer — typewriter effect */}
              {isThinkingLive && latestThinking ? (
                <div className="animate-flow-in py-1.5 px-3 rounded-lg bg-surface-tertiary/50 border-l-2 border-accent/30">
                  <p className="text-xs text-content-secondary italic">
                    <Typewriter text={latestThinking} speed={25} />
                  </p>
                </div>
              ) : null}

              {/* Completed structure badge */}
              {structureEvent && (isExecuting || !isActive) ? (
                <div className="animate-flow-in">
                  <CompletedStructure structure={structureEvent.data.structure as string[]} />
                </div>
              ) : null}

              {/* Step progress — only completed steps */}
              {completedSteps.length > 0 ? (
                <div className="space-y-1 animate-flow-in">
                  {completedSteps.map((event, i) => (
                    <div key={`step-${i}`} className="flex items-center gap-2 text-xs text-content-secondary">
                      <span className="text-green-400">✓</span>
                      <span>{String(event.data.text || '')}</span>
                      {typeof event.data.current === 'number' && typeof event.data.total === 'number' ? (
                        <span className="text-content-tertiary tabular-nums ml-auto">{event.data.current as number}/{event.data.total as number}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Approval cards — prominent when active */}
              {isApprovalGate && approvalType === 'send_email' ? (
                <div className="animate-flow-in">
                  <ApprovalCard
                    icon="✉️" label="邮件预览" loading={actionLoading}
                    onApprove={() => onApprove('send_email')} approveLabel="确认发送" loadingLabel="发送中..."
                    onSecondary={onReviseEmail} secondaryLabel="继续修改"
                    onReject={() => onReject('send_email')}
                  >
                    <EmailPreview interaction={currentInteraction as ConfirmInteraction} />
                  </ApprovalCard>
                </div>
              ) : null}

              {isApprovalGate && approvalType === 'use_structure' ? (
                <div className="animate-flow-in">
                  <ApprovalCard
                    icon="📊" label="演示文稿结构" loading={actionLoading}
                    onApprove={() => onApprove('use_structure')} approveLabel="继续生成"
                    onSecondary={onAdjustStructure} secondaryLabel="调整结构"
                    onReject={() => onReject('use_structure')}
                  >
                    <StructureList structure={((currentInteraction as ConfirmInteraction).detailData?.structure as string[]) || []} />
                  </ApprovalCard>
                </div>
              ) : null}

              {isApprovalGate && approvalType === 'use_proposal_structure' ? (
                <div className="animate-flow-in">
                  <ApprovalCard
                    icon="📋" label="方案结构" loading={actionLoading}
                    onApprove={() => onApprove('use_proposal_structure')} approveLabel="继续生成"
                    onSecondary={onAdjustProposal} secondaryLabel="调整结构"
                    onReject={() => onReject('use_proposal_structure')}
                  >
                    <StructureList structure={((currentInteraction as ConfirmInteraction).detailData?.structure as string[]) || []} />
                  </ApprovalCard>
                </div>
              ) : null}

              {/* Generic interaction */}
              {isGenericInteraction ? (
                <div className="animate-flow-in p-4 rounded-xl border border-accent/20 bg-accent/5">
                  <InteractionPanel interaction={currentInteraction!} onSubmit={onInteractionSubmit} />
                </div>
              ) : null}

              {/* Result */}
              {status === 'completed' && result !== null ? (
                <div className="animate-flow-in">
                  <ResultView result={result} />
                </div>
              ) : null}

              {/* Error */}
              {status === 'failed' ? (
                <div className="animate-flow-in p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">
                    {events.find((e) => e.type === 'error')
                      ? String(events.find((e) => e.type === 'error')!.data.message || '执行失败')
                      : '执行失败'}
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
      <div className="flex items-center gap-3 pt-1">
        <Button onClick={onApprove} size="sm" disabled={loading}>
          {loading ? (loadingLabel || '处理中...') : approveLabel}
        </Button>
        {onSecondary && secondaryLabel ? (
          <Button onClick={onSecondary} variant="secondary" size="sm" disabled={loading}>{secondaryLabel}</Button>
        ) : null}
        <button onClick={onReject} disabled={loading} className="text-xs text-content-tertiary hover:text-content-secondary transition-colors disabled:opacity-50 ml-auto">
          重新生成
        </button>
      </div>
    </div>
  );
}

function EmailPreview({ interaction }: { interaction: ConfirmInteraction }) {
  const dd = interaction.detailData;
  const subject = (dd?.subject as string) || '';
  const body = (dd?.body as string) || interaction.detail || '';
  return (
    <div className="space-y-3">
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
      <ResultContainer title="演示文稿生成完成" subtitle={`共 ${slides.length} 页`}>
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
      <ResultContainer title="邮件已确认发送">
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
      <ResultContainer title="方案生成完成" subtitle={summary}>
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
    <ResultContainer title="任务完成">
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

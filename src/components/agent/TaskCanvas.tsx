'use client';

import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { InteractionPanel } from './InteractionPanel';
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
  ppt: '演示文稿',
  email: '邮件',
  proposal: '方案',
  website: '网页',
  video: '视频',
  unknown: '任务',
};

export function TaskCanvas({
  taskId, title, type, status, events, currentInteraction,
  onInteractionSubmit, onApprove, onReject, onAdjustStructure, onAdjustProposal, onReviseEmail,
  actionLoading, result,
}: TaskCanvasProps) {
  const logs = events.filter((e) => e.type === 'log');
  const stepUpdates = events.filter((e) => e.type === 'step_update');
  const structureEvent = events.findLast((e) => e.type === 'structure_generated');
  const isActive = !['completed', 'failed'].includes(status);

  const approvalType = getApprovalType(currentInteraction);
  const isApprovalGate = approvalType !== null && status === 'interacting';
  const isGenericInteraction = currentInteraction !== null && status === 'interacting' && !isApprovalGate;

  const typeInfo = TASK_TYPES.find((t) => t.value === type);

  return (
    <div className="flex flex-col h-full">
      {/* Task header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base flex-shrink-0">{typeInfo?.icon || '📎'}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-content-primary truncate">{title || '新任务'}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge status={status} />
              <span className="text-xs text-content-tertiary">{TYPE_LABELS[type] || type}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Event timeline */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {/* Activity log */}
        {logs.map((event, i) => (
          <LogEntry key={`log-${i}`} message={String(event.data.message || '')} />
        ))}

        {/* Completed structure badge */}
        {structureEvent && (status === 'executing' || !isActive) ? (
          <CompletedStructure structure={structureEvent.data.structure as string[]} />
        ) : null}

        {/* Step progress */}
        {stepUpdates.map((event, i) => (
          <StepEntry key={`step-${i}`} data={event.data} />
        ))}

        {/* Loading states */}
        {isActive && status === 'executing' ? (
          <LoadingHint text="正在生成内容..." />
        ) : null}

        {status === 'understanding' ? (
          <LoadingHint text="正在理解需求..." />
        ) : null}

        {/* Approval cards */}
        {isApprovalGate && approvalType === 'send_email' ? (
          <ApprovalCard
            icon="✉️"
            label="邮件预览"
            loading={actionLoading}
            onApprove={() => onApprove('send_email')}
            approveLabel="确认发送"
            loadingLabel="发送中..."
            onSecondary={onReviseEmail}
            secondaryLabel="继续修改"
            onReject={() => onReject('send_email')}
          >
            <EmailPreview interaction={currentInteraction as ConfirmInteraction} />
          </ApprovalCard>
        ) : null}

        {isApprovalGate && approvalType === 'use_structure' ? (
          <ApprovalCard
            icon="📊"
            label="演示文稿结构"
            loading={actionLoading}
            onApprove={() => onApprove('use_structure')}
            approveLabel="继续生成"
            onSecondary={onAdjustStructure}
            secondaryLabel="调整结构"
            onReject={() => onReject('use_structure')}
          >
            <StructureList structure={((currentInteraction as ConfirmInteraction).detailData?.structure as string[]) || []} />
          </ApprovalCard>
        ) : null}

        {isApprovalGate && approvalType === 'use_proposal_structure' ? (
          <ApprovalCard
            icon="📋"
            label="方案结构"
            loading={actionLoading}
            onApprove={() => onApprove('use_proposal_structure')}
            approveLabel="继续生成"
            onSecondary={onAdjustProposal}
            secondaryLabel="调整结构"
            onReject={() => onReject('use_proposal_structure')}
          >
            <StructureList structure={((currentInteraction as ConfirmInteraction).detailData?.structure as string[]) || []} />
          </ApprovalCard>
        ) : null}

        {/* Generic interaction */}
        {isGenericInteraction ? (
          <div className="p-4 rounded-xl border border-accent/20 bg-accent/5">
            <InteractionPanel interaction={currentInteraction!} onSubmit={onInteractionSubmit} />
          </div>
        ) : null}

        {/* Result */}
        {status === 'completed' && result !== null ? <ResultView result={result} /> : null}

        {/* Error */}
        {status === 'failed' ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">
              {events.find((e) => e.type === 'error')
                ? String(events.find((e) => e.type === 'error')!.data.message || '执行失败')
                : '执行失败'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---- Shared sub-components ----

function LogEntry({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="text-accent/70 mt-0.5 flex-shrink-0 text-xs">›</span>
      <span className="text-content-secondary leading-relaxed">{message}</span>
    </div>
  );
}

function StepEntry({ data }: { data: Record<string, unknown> }) {
  const text = String(data.text || data.step || '');
  const current = data.current as number | undefined;
  const total = data.total as number | undefined;
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="text-green-400 mt-0.5 flex-shrink-0 text-xs">✓</span>
      <span className="text-content-primary flex-1">{text}</span>
      {current !== undefined && total !== undefined ? (
        <span className="text-content-tertiary text-xs tabular-nums">{current}/{total}</span>
      ) : null}
    </div>
  );
}

function LoadingHint({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-content-secondary text-sm py-1">
      <Spinner size="sm" /><span>{text}</span>
    </div>
  );
}

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

// ---- Unified approval card ----

function ApprovalCard({
  icon, label, loading, children,
  onApprove, approveLabel, loadingLabel,
  onSecondary, secondaryLabel,
  onReject,
}: {
  icon: string;
  label: string;
  loading: boolean;
  children: React.ReactNode;
  onApprove: () => void;
  approveLabel: string;
  loadingLabel?: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
  onReject: () => void;
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
          <Button onClick={onSecondary} variant="secondary" size="sm" disabled={loading}>
            {secondaryLabel}
          </Button>
        ) : null}
        <button
          onClick={onReject}
          disabled={loading}
          className="text-xs text-content-tertiary hover:text-content-secondary transition-colors disabled:opacity-50 ml-auto"
        >
          重新生成
        </button>
      </div>
    </div>
  );
}

// ---- Approval content blocks ----

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

// ---- Result views ----

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

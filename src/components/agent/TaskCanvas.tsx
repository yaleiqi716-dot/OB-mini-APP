'use client';

import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { InteractionPanel } from './InteractionPanel';
import { Interaction, ConfirmInteraction } from '@/types/interaction';
import { TaskStatus } from '@/types/task';

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
  onApproveStructure: () => void;
  onAdjustStructure: () => void;
  onSendEmail: () => void;
  actionLoading: boolean;
  result: Record<string, unknown> | null;
}

export function TaskCanvas({
  taskId,
  title,
  type,
  status,
  events,
  currentInteraction,
  onInteractionSubmit,
  onApproveStructure,
  onAdjustStructure,
  onSendEmail,
  actionLoading,
  result,
}: TaskCanvasProps) {
  const logs = events.filter((e) => e.type === 'log');
  const stepUpdates = events.filter((e) => e.type === 'step_update');
  const structureEvent = events.findLast((e) => e.type === 'structure_generated');
  const isActive = !['completed', 'failed'].includes(status);

  const isEmailConfirm =
    type === 'email' &&
    currentInteraction !== null &&
    currentInteraction.type === 'confirm' &&
    currentInteraction.stepId === 'confirm_send';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-content-primary">
            {title || '任务执行中'}
          </h3>
          <Badge status={status} />
        </div>
        <span className="text-xs text-content-tertiary">{type}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {logs.map((event, i) => (
          <LogEntry key={`log-${i}`} message={String(event.data.message || '')} />
        ))}

        {structureEvent && status === 'structuring' ? (
          <StructureCard
            structure={structureEvent.data.structure as string[]}
            onApprove={onApproveStructure}
            onAdjust={onAdjustStructure}
          />
        ) : null}

        {structureEvent && status !== 'structuring' && status !== 'understanding' && status !== 'pending' ? (
          <StructureCardCompleted structure={structureEvent.data.structure as string[]} />
        ) : null}

        {stepUpdates.map((event, i) => (
          <StepUpdateEntry key={`step-${i}`} data={event.data} />
        ))}

        {isActive && status === 'executing' ? (
          <div className="flex items-center gap-2 text-content-secondary text-sm">
            <Spinner size="sm" />
            <span>正在生成内容...</span>
          </div>
        ) : null}

        {status === 'understanding' ? (
          <div className="flex items-center gap-2 text-content-secondary text-sm">
            <Spinner size="sm" />
            <span>正在理解需求...</span>
          </div>
        ) : null}

        {isEmailConfirm && status === 'interacting' ? (
          <EmailConfirmCard
            interaction={currentInteraction as ConfirmInteraction}
            onSend={onSendEmail}
            onRevise={() => onInteractionSubmit('revise_email_request', '')}
            loading={actionLoading}
          />
        ) : null}

        {currentInteraction !== null && status === 'interacting' && !isEmailConfirm ? (
          <div className="mt-4 p-4 rounded-xl border border-accent/20 bg-accent/5">
            <InteractionPanel
              interaction={currentInteraction}
              onSubmit={onInteractionSubmit}
            />
          </div>
        ) : null}

        {status === 'completed' && result !== null ? (
          <ResultView result={result} />
        ) : null}

        {status === 'failed' ? (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {events.find((e) => e.type === 'error')
              ? String(events.find((e) => e.type === 'error')!.data.message || '任务执行失败')
              : '任务执行失败'}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LogEntry({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-accent mt-0.5 flex-shrink-0">›</span>
      <span className="text-content-secondary">{message}</span>
    </div>
  );
}

function StepUpdateEntry({ data }: { data: Record<string, unknown> }) {
  const text = String(data.text || data.step || '');
  const current = data.current as number | undefined;
  const total = data.total as number | undefined;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
      <span className="text-content-primary flex-1">{text}</span>
      {current !== undefined && total !== undefined ? (
        <span className="text-content-tertiary text-xs">{current}/{total}</span>
      ) : null}
    </div>
  );
}

function EmailConfirmCard({
  interaction,
  onSend,
  onRevise,
  loading,
}: {
  interaction: ConfirmInteraction;
  onSend: () => void;
  onRevise: () => void;
  loading: boolean;
}) {
  // Prefer structured detailData; fall back to parsing detail string
  const detailData = interaction.detailData as { subject?: string; body?: string } | undefined;
  let subject = detailData?.subject || '';
  let body = detailData?.body || '';

  if (!subject && !body && interaction.detail) {
    const lines = interaction.detail.split('\n');
    const subjectLine = lines.find((l) => l.startsWith('主题：'));
    if (subjectLine) {
      subject = subjectLine.replace('主题：', '').trim();
      const idx = lines.indexOf(subjectLine);
      body = lines.slice(idx + 1).join('\n').trim();
    } else {
      body = interaction.detail;
    }
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-accent text-sm font-medium">邮件预览</span>
      </div>

      {subject ? (
        <div className="space-y-1">
          <p className="text-xs text-content-tertiary">主题</p>
          <p className="text-sm font-medium text-content-primary">{subject}</p>
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="text-xs text-content-tertiary">正文</p>
        <div className="rounded-lg bg-surface-secondary border border-border p-4">
          <p className="text-sm text-content-secondary whitespace-pre-wrap leading-relaxed">{body}</p>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button onClick={onSend} size="sm" disabled={loading}>
          {loading ? '发送中...' : '确认发送'}
        </Button>
        <Button onClick={onRevise} variant="secondary" size="sm" disabled={loading}>
          继续修改
        </Button>
      </div>
    </div>
  );
}

function StructureCard({ structure, onApprove, onAdjust }: { structure: string[]; onApprove: () => void; onAdjust: () => void }) {
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-accent text-sm font-medium">结构预览</span>
        <span className="text-xs text-content-tertiary">共 {structure.length} 页</span>
      </div>
      <div className="space-y-2">
        {structure.map((item, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-secondary border border-border">
            <span className="text-xs text-accent font-mono w-6 text-center">{i + 1}</span>
            <span className="text-sm text-content-primary">{item}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        <Button onClick={onApprove} size="sm">继续生成</Button>
        <Button onClick={onAdjust} variant="secondary" size="sm">调整结构</Button>
      </div>
    </div>
  );
}

function StructureCardCompleted({ structure }: { structure: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface-secondary p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-green-400 text-sm">✓</span>
        <span className="text-sm text-content-secondary">结构已确认</span>
        <span className="text-xs text-content-tertiary">共 {structure.length} 页</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {structure.map((item, i) => (
          <span key={i} className="text-xs px-2 py-1 rounded bg-surface-tertiary text-content-secondary border border-border">{item}</span>
        ))}
      </div>
    </div>
  );
}

function ResultView({ result }: { result: Record<string, unknown> }) {
  const data = result;
  const resultType = data.type as string;

  if (resultType === 'ppt' && data.slides) {
    const slides = data.slides as { index: number; title: string; content: string[]; notes: string }[];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
          <span>✓</span><span>演示文稿生成完成，共 {slides.length} 页</span>
        </div>
        <div className="space-y-3">
          {slides.map((slide) => (
            <div key={slide.index} className="p-3 rounded-lg bg-surface-tertiary border border-border">
              <p className="text-sm font-medium text-content-primary mb-2">第 {slide.index + 1} 页：{slide.title}</p>
              <ul className="space-y-1">
                {slide.content.map((item, i) => (
                  <li key={i} className="text-xs text-content-secondary flex gap-2"><span className="text-accent">·</span>{item}</li>
                ))}
              </ul>
              {slide.notes ? <p className="mt-2 text-xs text-content-tertiary italic">备注：{slide.notes}</p> : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (resultType === 'email' && data.content) {
    const email = data.content as { subject: string; body: string };
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
          <span>✓</span><span>邮件已确认发送</span>
        </div>
        <div className="p-4 rounded-lg bg-surface-tertiary border border-border">
          <p className="text-sm font-medium text-content-primary mb-3">主题：{email.subject}</p>
          <p className="text-sm text-content-secondary whitespace-pre-wrap leading-relaxed">{email.body}</p>
        </div>
      </div>
    );
  }

  if (resultType === 'proposal' && data.content) {
    const proposal = data.content as { title: string; sections: { heading: string; content: string }[]; summary: string };
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
          <span>✓</span><span>方案生成完成</span>
        </div>
        <div className="p-4 rounded-lg bg-surface-tertiary border border-border space-y-4">
          <p className="text-sm font-medium text-content-primary">{proposal.title}</p>
          {proposal.sections?.map((s, i) => (
            <div key={i}>
              <p className="text-sm font-medium text-accent mb-1">{s.heading}</p>
              <p className="text-sm text-content-secondary whitespace-pre-wrap">{s.content}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
        <span>✓</span><span>任务完成</span>
      </div>
      <div className="p-4 rounded-lg bg-surface-tertiary border border-border">
        <pre className="text-xs text-content-secondary whitespace-pre-wrap font-sans">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}

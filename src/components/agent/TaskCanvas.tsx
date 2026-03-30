'use client';

import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { InteractionPanel } from './InteractionPanel';
import { Interaction } from '@/types/interaction';
import { TaskStatus } from '@/types/task';
import { cn } from '@/lib/utils';

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
  result,
}: TaskCanvasProps) {
  const logs = events.filter((e) => e.type === 'log');
  const steps = events.filter((e) => e.type === 'step_complete');
  const isActive = !['completed', 'failed'].includes(status);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-content-primary">
            {title || '任务执行中'}
          </h3>
          <Badge status={status} />
        </div>
        <span className="text-xs text-content-tertiary">{type}</span>
      </div>

      {/* Event Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {logs.map((event, i) => (
          <LogEntry key={i} message={String((event.data as Record<string, unknown>).message || '')} />
        ))}

        {steps.map((event, i) => {
          const data = event.data as Record<string, unknown>;
          const stepData = data.data as Record<string, unknown> | undefined;
          return (
            <StepEntry
              key={i}
              step={String(data.step || '')}
              data={stepData}
            />
          );
        })}

        {isActive && status === 'executing' && (
          <div className="flex items-center gap-2 text-content-secondary text-sm">
            <Spinner size="sm" />
            <span>正在执行...</span>
          </div>
        )}

        {/* Interaction */}
        {currentInteraction !== null && status === 'interacting' ? (
          <div className="mt-4 p-4 rounded-xl border border-accent/20 bg-accent/5">
            <InteractionPanel
              interaction={currentInteraction}
              onSubmit={onInteractionSubmit}
            />
          </div>
        ) : null}

        {/* Result */}
        {status === 'completed' && result !== null ? (
          <ResultView result={result} />
        ) : null}

        {/* Error */}
        {status === 'failed' && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {events.find((e) => e.type === 'error')
              ? String((events.find((e) => e.type === 'error')!.data as Record<string, unknown>).message || '任务执行失败')
              : '任务执行失败'}
          </div>
        )}
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

function StepEntry({ step, data }: { step: string; data?: Record<string, unknown> }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
      <span className="text-content-primary">{step}</span>
    </div>
  );
}

function ResultView({ result }: { result: Record<string, unknown> }) {
  const data = result;
  const type = data.type as string;

  if (type === 'ppt' && data.slides) {
    const slides = data.slides as { index: number; title: string; content: string[]; notes: string }[];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
          <span>✓</span>
          <span>演示文稿生成完成，共 {slides.length} 页</span>
        </div>
        <div className="space-y-3">
          {slides.map((slide) => (
            <div key={slide.index} className="p-3 rounded-lg bg-surface-tertiary border border-border">
              <p className="text-sm font-medium text-content-primary mb-2">
                第 {slide.index + 1} 页：{slide.title}
              </p>
              <ul className="space-y-1">
                {slide.content.map((item, i) => (
                  <li key={i} className="text-xs text-content-secondary flex gap-2">
                    <span className="text-accent">·</span>
                    {item}
                  </li>
                ))}
              </ul>
              {slide.notes && (
                <p className="mt-2 text-xs text-content-tertiary italic">
                  备注：{slide.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'email' && data.content) {
    const email = data.content as { subject: string; body: string };
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
          <span>✓</span>
          <span>邮件生成完成</span>
        </div>
        <div className="p-4 rounded-lg bg-surface-tertiary border border-border">
          <p className="text-sm font-medium text-content-primary mb-3">
            主题：{email.subject}
          </p>
          <p className="text-sm text-content-secondary whitespace-pre-wrap leading-relaxed">
            {email.body}
          </p>
        </div>
      </div>
    );
  }

  if (type === 'proposal' && data.content) {
    const proposal = data.content as { title: string; sections: { heading: string; content: string }[]; summary: string };
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
          <span>✓</span>
          <span>方案生成完成</span>
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

  // Generic result
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
        <span>✓</span>
        <span>任务完成</span>
      </div>
      <div className="p-4 rounded-lg bg-surface-tertiary border border-border">
        <pre className="text-xs text-content-secondary whitespace-pre-wrap font-sans">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

'use client';

import { Button } from '@/components/ui/Button';

interface ConfirmProps {
  question: string;
  detail: string;
  onSubmit: (confirmed: boolean) => void;
  disabled?: boolean;
}

export function Confirm({ question, detail, onSubmit, disabled }: ConfirmProps) {
  return (
    <div className="space-y-4">
      <p className="text-content-primary font-medium">{question}</p>
      <div className="rounded-lg bg-surface-tertiary border border-border p-4 max-h-80 overflow-y-auto">
        <pre className="text-sm text-content-secondary whitespace-pre-wrap font-sans leading-relaxed">
          {detail}
        </pre>
      </div>
      <div className="flex gap-3">
        <Button onClick={() => onSubmit(true)} disabled={disabled} size="sm">
          确认
        </Button>
        <Button
          onClick={() => onSubmit(false)}
          disabled={disabled}
          variant="secondary"
          size="sm"
        >
          重新生成
        </Button>
      </div>
    </div>
  );
}

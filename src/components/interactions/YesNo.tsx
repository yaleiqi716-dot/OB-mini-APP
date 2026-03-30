'use client';

import { Button } from '@/components/ui/Button';

interface YesNoProps {
  question: string;
  onSubmit: (value: boolean) => void;
  disabled?: boolean;
}

export function YesNo({ question, onSubmit, disabled }: YesNoProps) {
  return (
    <div className="space-y-4">
      <p className="text-content-primary font-medium">{question}</p>
      <div className="flex gap-3">
        <Button onClick={() => onSubmit(true)} disabled={disabled} size="sm">
          是
        </Button>
        <Button
          onClick={() => onSubmit(false)}
          disabled={disabled}
          variant="secondary"
          size="sm"
        >
          否
        </Button>
      </div>
    </div>
  );
}

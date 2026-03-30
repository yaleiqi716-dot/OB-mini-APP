'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface SingleChoiceProps {
  question: string;
  options: { label: string; value: string }[];
  onSubmit: (value: string) => void;
  disabled?: boolean;
}

export function SingleChoice({ question, options, onSubmit, disabled }: SingleChoiceProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-content-primary font-medium">{question}</p>
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            disabled={disabled}
            onClick={() => setSelected(opt.value)}
            className={cn(
              'w-full text-left px-4 py-3 rounded-lg border transition-all text-sm',
              'hover:border-accent/40 hover:bg-surface-tertiary',
              selected === opt.value
                ? 'border-accent bg-accent/10 text-content-primary'
                : 'border-border bg-surface-secondary text-content-secondary'
            )}
          >
            <span className="flex items-center gap-3">
              <span
                className={cn(
                  'h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors',
                  selected === opt.value ? 'border-accent' : 'border-content-tertiary'
                )}
              >
                {selected === opt.value && (
                  <span className="h-2 w-2 rounded-full bg-accent" />
                )}
              </span>
              {opt.label}
            </span>
          </button>
        ))}
      </div>
      <Button
        onClick={() => selected && onSubmit(selected)}
        disabled={!selected || disabled}
        size="sm"
      >
        确认
      </Button>
    </div>
  );
}

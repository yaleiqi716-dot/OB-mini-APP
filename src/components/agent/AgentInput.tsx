'use client';

import { useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface AgentInputProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
  placeholder?: string;
  prominent?: boolean;
}

export function AgentInput({ onSubmit, disabled, placeholder, prominent }: AgentInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div
        className={cn(
          'flex items-end gap-2 rounded-2xl border bg-surface-secondary p-3 transition-all',
          'focus-within:border-accent/50 focus-within:bg-surface-tertiary focus-within:shadow-sm',
          prominent
            ? 'border-border/80 shadow-sm'
            : 'border-border'
        )}
      >
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onSubmit={handleSubmit}
          placeholder={placeholder || '说一句话，我来帮你完成'}
          disabled={disabled}
          className="flex-1 min-h-[24px] text-[15px]"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className={cn(
            'flex-shrink-0 rounded-xl p-2.5 transition-all touch-manipulation',
            value.trim() && !disabled
              ? 'bg-accent text-white hover:bg-accent-hover active:scale-95'
              : 'bg-surface-tertiary text-content-tertiary'
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

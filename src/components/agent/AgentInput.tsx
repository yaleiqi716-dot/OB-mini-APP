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

  const canSend = !!value.trim() && !disabled;

  return (
    <div className="agent-input-wrap">
      <div className={cn('agent-input-box', prominent && 'agent-input-box--prominent')}>
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onSubmit={handleSubmit}
          placeholder={placeholder || '说一句话，我来帮你完成'}
          disabled={disabled}
          className="agent-input-textarea"
        />
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="发送"
          className={cn(
            'agent-send-btn',
            canSend ? 'agent-send-btn--active' : 'agent-send-btn--idle'
          )}
        >
          {/* Up-arrow icon — matches ChatGPT send button */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4l8 8h-5v8H9v-8H4l8-8z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

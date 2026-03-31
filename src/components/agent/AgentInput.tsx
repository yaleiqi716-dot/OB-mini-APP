'use client';

import { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface AgentInputProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
  placeholder?: string;
  prominent?: boolean;
}

export function AgentInput({ onSubmit, disabled, placeholder, prominent }: AgentInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = !!value.trim() && !disabled;

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="agent-input-wrap ob-input-wrap">
      <div
        className={cn(
          'agent-input-box ob-input-box',
          prominent && 'agent-input-box--prominent ob-input-box--prominent'
        )}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || '说一句话，我来帮你完成'}
          disabled={disabled}
          className="agent-input-textarea ob-textarea w-full resize-none bg-transparent outline-none border-none"
          style={{ fontFamily: 'inherit', fontSize: '15px', lineHeight: '1.55' }}
        />
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="发送"
          className={cn(
            'agent-send-btn ob-send-btn',
            canSend
              ? 'agent-send-btn--active ob-send-btn--on'
              : 'agent-send-btn--idle ob-send-btn--off'
          )}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4l8 8h-5v8H9v-8H4l8-8z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

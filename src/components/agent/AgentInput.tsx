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
    <div className="ob-input-wrap agent-input-wrap">
      <div
        className={cn(
          'ob-input-box agent-input-box',
          prominent && 'ob-input-box--prominent agent-input-box--prominent'
        )}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={3}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || '请输入任务，然后交给 ORANGEBENCH Agent'}
          disabled={disabled}
          className="ob-textarea agent-input-textarea w-full"
          style={{ fontFamily: 'inherit' }}
        />

        {/* Bottom toolbar — MiniMax style */}
        <div className="ob-input-toolbar">
          <div className="ob-input-toolbar-left">
            {/* Attach icon */}
            <button
              type="button"
              className="ob-toolbar-btn"
              tabIndex={-1}
              aria-label="附件"
              disabled={disabled}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
          </div>

          <div className="ob-input-toolbar-right">
            {/* Send button — MiniMax dark circle */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSend}
              aria-label="发送"
              className={cn(
                'ob-send-btn agent-send-btn',
                canSend
                  ? 'ob-send-btn--on agent-send-btn--active'
                  : 'ob-send-btn--off agent-send-btn--idle'
              )}
            >
              {disabled ? (
                /* Spinner when running */
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }} />
                </svg>
              ) : (
                /* Up arrow */
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4l8 8h-5v8H9v-8H4l8-8z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Hint when submitting */}
      {disabled && (
        <div className="agent-submitting-hint">
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #ccc', borderTopColor: '#888', animation: 'spin 0.7s linear infinite' }} />
          <span>Agent 正在处理…</span>
        </div>
      )}
    </div>
  );
}

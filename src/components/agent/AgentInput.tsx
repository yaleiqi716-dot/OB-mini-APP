'use client';

import { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface AgentInputProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
  placeholder?: string;
  prominent?: boolean;
  chatMode?: boolean;
}

export function AgentInput({ onSubmit, disabled, placeholder, prominent, chatMode }: AgentInputProps) {
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
    <div className={cn('ob-input-wrap agent-input-wrap', chatMode && 'ob-input-wrap--chat')}>
      <div
        className={cn(
          'ob-input-box agent-input-box',
          prominent && 'ob-input-box--prominent agent-input-box--prominent',
          chatMode && 'ob-input-box--chat agent-input-box--chat'
        )}
      >
        <textarea
          ref={textareaRef}
          rows={prominent ? 4 : 2}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || '描述你的任务...'}
          disabled={disabled}
          className="ob-textarea agent-input-textarea w-full"
          style={{ fontFamily: 'inherit', padding: chatMode ? '14px 14px 6px' : undefined }}
        />

        {/* Bottom toolbar */}
        <div className="ob-input-toolbar" style={chatMode ? { padding: '2px 14px 10px' } : undefined}>
          <div className="ob-input-toolbar-left">
            <button type="button" className="ob-toolbar-btn" aria-label="附件" title="附件" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <button type="button" className="ob-toolbar-label" aria-label="工具" disabled style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#7A7A7A' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
              工具
            </button>
          </div>

          <div className="ob-input-toolbar-right" style={{ gap: 12 }}>
            <span className="ob-auto-badge" aria-label="Auto mode">Auto</span>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }} />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4l8 8h-5v8H9v-8H4l8-8z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

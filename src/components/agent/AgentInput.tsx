'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
}

interface AgentInputProps {
  onSubmit: (input: string, attachments?: UploadedFile[]) => void;
  disabled?: boolean;
  placeholder?: string;
  /**
   * When true, render the DESIGN.md v1.2 composer — floating AGENT label,
   * multiline textarea, 3-zone toolbar, circular orange send button with
   * Lucide send-horizontal icon. This is the hero input on /agent landing.
   */
  prominent?: boolean;
  chatMode?: boolean;
}

export function AgentInput({ onSubmit, disabled, placeholder, prominent, chatMode }: AgentInputProps) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = (!!value.trim() || attachments.length > 0) && !disabled && !uploading;

  // Auto-resize textarea in composer v2 and chat modes, but cap the growth.
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = prominent ? 200 : 160;
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
  }, [prominent]);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  function handleSubmit() {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled || uploading) return;
    const fileContext = attachments.length > 0
      ? `\n\n[附件: ${attachments.map(f => f.name).join(', ')}]`
      : '';
    onSubmit(trimmed + fileContext, attachments.length > 0 ? attachments : undefined);
    setValue('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+Enter or plain Enter (without shift) submits
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('文件大小超过 10MB 限制');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.file) {
        setAttachments(prev => [...prev, data.file]);
      } else {
        alert(data.error || '上传失败');
      }
    } catch {
      alert('上传失败，请重试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeAttachment(id: string) {
    setAttachments(prev => prev.filter(f => f.id !== id));
  }

  // ═══════════════════════════════════════════════════════════════
  // Composer v2 (prominent mode — DESIGN.md reference)
  // ═══════════════════════════════════════════════════════════════
  if (prominent) {
    return (
      <div
        className="ob-composer-v2"
        style={{
          position: 'relative',
          background: 'var(--ob-surface)',
          border: `1px solid ${focused ? 'var(--ob-orange)' : 'var(--ob-border)'}`,
          borderRadius: 16,
          padding: '18px 20px 14px',
          boxShadow: focused ? '0 0 0 4px var(--ob-orange-a10, rgba(255,90,31,0.10))' : 'none',
          transition: 'border-color .15s cubic-bezier(.2,.7,.3,1), box-shadow .15s cubic-bezier(.2,.7,.3,1)',
          width: '100%',
          maxWidth: 760,
        }}
      >
        {/* Floating label riding the top border */}
        <div
          style={{
            position: 'absolute',
            top: -8,
            left: 16,
            background: 'var(--ob-bg)',
            padding: '0 8px',
            fontFamily: 'var(--ob-font-mono)',
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ob-text-muted)',
          }}
        >
          <span style={{ color: 'var(--ob-orange)', fontWeight: 600 }}>AGENT</span>
          <span style={{ margin: '0 6px' }}>·</span>
          输入任务
        </div>

        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {attachments.map(f => (
              <span
                key={f.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 26,
                  padding: '0 8px 0 10px',
                  borderRadius: 9999,
                  fontSize: 12,
                  color: 'var(--ob-text-muted)',
                  background: 'var(--ob-surface-hi)',
                  border: '1px solid var(--ob-border)',
                  fontFamily: 'var(--ob-font-mono)',
                }}
              >
                {f.name.length > 24 ? f.name.slice(0, 21) + '…' : f.name}
                <button
                  type="button"
                  onClick={() => removeAttachment(f.id)}
                  aria-label={`移除 ${f.name}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ob-text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Textarea — real multiline, auto-resize */}
        <textarea
          ref={textareaRef}
          rows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder || '描述你要完成的任务，或者继续对话 · 支持附件和 Markdown'}
          disabled={disabled}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: 'var(--ob-text)',
            fontFamily: 'var(--ob-font-body)',
            fontSize: 15,
            lineHeight: 1.55,
            padding: 0,
            marginBottom: 14,
            minHeight: 48,
          }}
        />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept=".txt,.csv,.md,.pdf,.json,.png,.jpg,.jpeg,.gif,.webp,.docx,.xlsx,.pptx"
          style={{ display: 'none' }}
        />

        {/* Bottom toolbar: 3 zones */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            borderTop: '1px solid var(--ob-border)',
            paddingTop: 12,
          }}
        >
          {/* LEFT: tool buttons + model chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || disabled}
              title="附件"
              aria-label="附件"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 6,
                background: 'transparent',
                border: 'none',
                cursor: uploading || disabled ? 'not-allowed' : 'pointer',
                color: 'var(--ob-text-muted)',
                transition: 'all .12s cubic-bezier(.2,.7,.3,1)',
                opacity: uploading ? 0.5 : 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ob-surface-hi)'; e.currentTarget.style.color = 'var(--ob-text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ob-text-muted)'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <button
              type="button"
              title="命令面板 ⌘K"
              aria-label="命令面板"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 6,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--ob-text-muted)',
                transition: 'all .12s cubic-bezier(.2,.7,.3,1)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ob-surface-hi)'; e.currentTarget.style.color = 'var(--ob-text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ob-text-muted)'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M9 9h6v6H9z"/>
              </svg>
            </button>
            <span
              title="模型选择"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 28,
                padding: '0 12px',
                marginLeft: 4,
                borderRadius: 9999,
                background: 'var(--ob-surface-hi)',
                border: '1px solid var(--ob-border)',
                color: 'var(--ob-text)',
                fontFamily: 'var(--ob-font-mono)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all .12s cubic-bezier(.2,.7,.3,1)',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--ob-orange)',
                  boxShadow: '0 0 6px var(--ob-orange-a20, rgba(255,90,31,0.20))',
                }}
              />
              gpt-4o
              <span style={{ color: 'var(--ob-text-muted)', fontSize: 9, marginLeft: 2 }}>▾</span>
            </span>
          </div>

          {/* RIGHT: cost hint + kbd hint + circular send button */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginRight: 12,
                fontFamily: 'var(--ob-font-mono)',
                fontSize: 11,
                color: 'var(--ob-text-dim)',
                whiteSpace: 'nowrap',
              }}
            >
              <kbd
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 20,
                  height: 20,
                  padding: '0 5px',
                  borderRadius: 4,
                  background: 'var(--ob-surface-hi)',
                  border: '1px solid var(--ob-border)',
                  fontFamily: 'var(--ob-font-mono)',
                  fontSize: 10,
                  color: 'var(--ob-text-muted)',
                  fontWeight: 500,
                }}
              >⌘</kbd>
              <kbd
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 20,
                  height: 20,
                  padding: '0 5px',
                  borderRadius: 4,
                  background: 'var(--ob-surface-hi)',
                  border: '1px solid var(--ob-border)',
                  fontFamily: 'var(--ob-font-mono)',
                  fontSize: 10,
                  color: 'var(--ob-text-muted)',
                  fontWeight: 500,
                }}
              >↵</kbd>
              <span style={{ marginLeft: 4 }}>发送</span>
            </span>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSend}
              aria-label="发送任务"
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                background: canSend ? 'var(--ob-orange)' : 'var(--ob-surface-hi)',
                color: canSend ? '#fff' : 'var(--ob-text-dim)',
                border: canSend ? 'none' : '1px solid var(--ob-border)',
                borderRadius: '50%',
                cursor: canSend ? 'pointer' : 'not-allowed',
                transition: 'all .18s cubic-bezier(.2,.7,.3,1)',
                boxShadow: canSend
                  ? '0 1px 0 rgba(255,255,255,0.12) inset, 0 6px 18px -6px rgba(255,90,31,0.6)'
                  : 'none',
              }}
              onMouseEnter={(e) => {
                if (canSend) {
                  e.currentTarget.style.background = 'var(--ob-orange-lo)';
                  e.currentTarget.style.transform = 'translateY(-1px) rotate(-2deg)';
                  e.currentTarget.style.boxShadow = '0 1px 0 rgba(255,255,255,0.14) inset, 0 10px 24px -6px rgba(255,90,31,0.8)';
                }
              }}
              onMouseLeave={(e) => {
                if (canSend) {
                  e.currentTarget.style.background = 'var(--ob-orange)';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 1px 0 rgba(255,255,255,0.12) inset, 0 6px 18px -6px rgba(255,90,31,0.6)';
                }
              }}
            >
              {disabled ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }} />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: 'translateX(-1px) translateY(1px)' }}
                >
                  <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/>
                  <path d="m21.854 2.147-10.94 10.939"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Compact / chat mode (unchanged visual structure; uses CSS classes
  // from globals.css which now resolve through the v1.2 token aliases)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className={cn('ob-input-wrap agent-input-wrap', chatMode && 'ob-input-wrap--chat')}>
      <div
        className={cn(
          'ob-input-box agent-input-box',
          chatMode && 'ob-input-box--chat agent-input-box--chat'
        )}
      >
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 16px 0' }}>
            {attachments.map(f => (
              <span key={f.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                height: 26, padding: '0 8px 0 10px', borderRadius: 9999,
                fontSize: 12, color: 'var(--ob-text-muted)',
                background: 'var(--ob-surface-hi)', border: '1px solid var(--ob-border)',
              }}>
                {f.name.length > 20 ? f.name.slice(0, 17) + '...' : f.name}
                <button
                  type="button"
                  onClick={() => removeAttachment(f.id)}
                  aria-label={`移除 ${f.name}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ob-text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || '描述你的任务...'}
          disabled={disabled}
          className="ob-textarea agent-input-textarea w-full"
          style={{
            fontFamily: 'inherit',
            ...(chatMode ? { padding: '14px 14px 6px' } : {}),
          }}
        />

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept=".txt,.csv,.md,.pdf,.json,.png,.jpg,.jpeg,.gif,.webp,.docx,.xlsx,.pptx"
          style={{ display: 'none' }}
        />

        <div className="ob-input-toolbar" style={chatMode ? { padding: '2px 14px 10px' } : undefined}>
          <div className="ob-input-toolbar-left">
            <button
              type="button"
              className="ob-toolbar-btn"
              aria-label="附件"
              title="附件"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || disabled}
              style={uploading ? { opacity: 0.5 } : undefined}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
          </div>

          <div className="ob-input-toolbar-right" style={{ gap: 12 }}>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/>
                  <path d="m21.854 2.147-10.94 10.939"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

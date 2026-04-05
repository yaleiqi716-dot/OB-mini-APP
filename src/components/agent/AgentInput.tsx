'use client';

import { useRef, useState, useCallback } from 'react';
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
  prominent?: boolean;
  chatMode?: boolean;
}

export function AgentInput({ onSubmit, disabled, placeholder, prominent, chatMode }: AgentInputProps) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = (!!value.trim() || attachments.length > 0) && !disabled && !uploading;

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

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

  return (
    <div className={cn('ob-input-wrap agent-input-wrap', chatMode && 'ob-input-wrap--chat')}>
      <div
        className={cn(
          'ob-input-box agent-input-box',
          prominent && 'ob-input-box--prominent agent-input-box--prominent',
          chatMode && 'ob-input-box--chat agent-input-box--chat'
        )}
      >
        {/* Attachment preview */}
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 16px 0' }}>
            {attachments.map(f => (
              <span key={f.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                height: 26, padding: '0 8px 0 10px', borderRadius: 9999,
                fontSize: 12, color: '#888888',
                background: '#2A2826', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                {f.name.length > 20 ? f.name.slice(0, 17) + '...' : f.name}
                <button
                  type="button"
                  onClick={() => removeAttachment(f.id)}
                  aria-label={`移除 ${f.name}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CCCCCC', padding: 0, lineHeight: 1, fontSize: 14 }}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}

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

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept=".txt,.csv,.md,.pdf,.json,.png,.jpg,.jpeg,.gif,.webp,.docx,.xlsx,.pptx"
          style={{ display: 'none' }}
        />

        {/* Bottom toolbar */}
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
              {uploading ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }} />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              )}
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

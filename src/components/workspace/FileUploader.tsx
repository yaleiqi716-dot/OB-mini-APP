'use client';

import { useRef, useState } from 'react';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedBy?: string;
  uploadedAt?: string;
}

interface FileUploaderProps {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  disabled?: boolean;
  label?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploader({ files, onChange, disabled, label }: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('文件大小超过 10MB 限制'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.file) {
        onChange([...files, { ...data.file, uploadedAt: new Date().toISOString() }]);
      } else {
        alert(data.error || '上传失败');
      }
    } catch { alert('上传失败'); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div>
      {label && <p style={{ fontSize: 14, fontWeight: 500, color: '#171717', marginBottom: 8 }}>{label}</p>}

      {/* File list */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {files.map((f, i) => (
            <div key={f.id || i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: 10,
              background: '#F7F7F4', border: '1px solid #F0EDE8',
            }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <span style={{ fontSize: 13, color: '#171717', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </span>
                <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{formatSize(f.size)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#FF6B2C', textDecoration: 'none' }}>下载</a>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onChange(files.filter((_, j) => j !== i))}
                    aria-label={`移除 ${f.name}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 14, padding: 0, lineHeight: 1 }}
                  >×</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {!disabled && (
        <>
          <input ref={fileInputRef} type="file" onChange={handleSelect} style={{ display: 'none' }}
            accept=".txt,.csv,.md,.pdf,.json,.png,.jpg,.jpeg,.gif,.webp,.docx,.xlsx,.pptx" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 32, padding: '0 14px', borderRadius: 9999,
              fontSize: 13, fontWeight: 500,
              border: '1px solid #E7E5E1', background: '#FFFFFF',
              color: uploading ? '#9CA3AF' : '#6B7280', cursor: uploading ? 'wait' : 'pointer',
              transition: 'border-color .2s, color .2s',
            }}
            onMouseEnter={e => { if (!uploading) { e.currentTarget.style.borderColor = 'rgba(255,107,44,0.3)'; e.currentTarget.style.color = '#FF6B2C'; }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E7E5E1'; e.currentTarget.style.color = '#6B7280'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
            {uploading ? '上传中...' : '添加附件'}
          </button>
        </>
      )}
    </div>
  );
}

// Read-only display of attachments
export function AttachmentList({ files, title }: { files: UploadedFile[]; title?: string }) {
  if (!files || files.length === 0) return null;
  return (
    <div>
      {title && <p style={{ fontSize: 13, fontWeight: 500, color: '#9CA3AF', margin: '0 0 8px' }}>{title}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {files.map((f, i) => (
          <div key={f.id || i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderRadius: 10,
            background: '#F7F7F4', border: '1px solid #F0EDE8',
          }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              <span style={{ fontSize: 13, color: '#171717', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{formatSize(f.size)}</span>
            </div>
            <a href={f.url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: '#FF6B2C', textDecoration: 'none', flexShrink: 0 }}>下载</a>
          </div>
        ))}
      </div>
    </div>
  );
}

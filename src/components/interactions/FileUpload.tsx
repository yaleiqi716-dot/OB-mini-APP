'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  question: string;
  accept?: string;
  onSubmit: (file: File) => void;
  disabled?: boolean;
}

export function FileUpload({ question, accept, onSubmit, disabled }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  return (
    <div className="space-y-4">
      <p className="text-content-primary font-medium">{question}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      <div
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border rounded-ob-card p-6 text-center cursor-pointer transition-colors',
          'hover:border-accent/60 hover:bg-surface-tertiary',
          file ? 'border-accent bg-accent/10' : 'border-border'
        )}
      >
        {file ? (
          <p className="text-content-primary text-sm">{file.name}</p>
        ) : (
          <p className="text-content-tertiary text-sm">点击选择文件</p>
        )}
      </div>
      <Button
        onClick={() => file && onSubmit(file)}
        disabled={!file || disabled}
        size="sm"
      >
        上传
      </Button>
    </div>
  );
}

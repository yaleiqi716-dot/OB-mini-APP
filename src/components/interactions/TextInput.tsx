'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface TextInputProps {
  question: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  disabled?: boolean;
}

export function TextInput({ question, placeholder, onSubmit, disabled }: TextInputProps) {
  const [value, setValue] = useState('');

  return (
    <div className="space-y-4">
      <p className="text-content-primary font-medium">{question}</p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder || '请输入...'}
        rows={3}
        className="w-full rounded-lg border border-border bg-surface-tertiary px-4 py-3 text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-accent/40 resize-none"
      />
      <Button
        onClick={() => value.trim() && onSubmit(value.trim())}
        disabled={!value.trim() || disabled}
        size="sm"
      >
        确认
      </Button>
    </div>
  );
}

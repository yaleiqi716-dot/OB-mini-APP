'use client';

import { cn } from '@/lib/utils';
import { TextareaHTMLAttributes, forwardRef, useEffect, useRef } from 'react';

interface InputProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  onSubmit?: () => void;
}

export const Input = forwardRef<HTMLTextAreaElement, InputProps>(
  ({ className, onSubmit, onKeyDown, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    function autoResize() {
      const el = textareaRef.current;
      if (el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 200) + 'px';
      }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit?.();
      }
      onKeyDown?.(e);
    }

    return (
      <textarea
        ref={textareaRef}
        rows={1}
        onInput={autoResize}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full resize-none bg-transparent text-content-primary',
          'placeholder:text-content-tertiary',
          'focus:outline-none',
          'text-base leading-6',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

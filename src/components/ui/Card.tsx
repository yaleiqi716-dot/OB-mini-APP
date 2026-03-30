'use client';

import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean;
}

export function Card({ className, active, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface-secondary p-4 transition-all',
        'hover:border-accent/30 hover:bg-surface-tertiary cursor-pointer',
        active && 'border-accent/50 bg-surface-tertiary',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

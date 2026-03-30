'use client';

import { cn } from '@/lib/utils';

interface WorkCardProps {
  title: string;
  description: string;
  icon?: string;
  onClick: () => void;
}

export function WorkCard({ title, description, icon, onClick }: WorkCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1.5 rounded-xl border border-border bg-surface-secondary p-4',
        'hover:border-accent/30 hover:bg-surface-tertiary transition-all text-left',
        'min-w-[160px] max-w-[200px]'
      )}
    >
      {icon && <span className="text-lg">{icon}</span>}
      <span className="text-sm font-medium text-content-primary">{title}</span>
      <span className="text-xs text-content-tertiary line-clamp-2">{description}</span>
    </button>
  );
}

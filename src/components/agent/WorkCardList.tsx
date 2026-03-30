'use client';

import { WORK_CARDS, TASK_TYPES } from '@/lib/constants';

interface WorkCardListProps {
  onSelect: (prompt: string, type: string) => void;
}

export function WorkCardList({ onSelect }: WorkCardListProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {WORK_CARDS.map((card) => {
        const typeInfo = TASK_TYPES.find((t) => t.value === card.type);
        return (
          <button
            key={card.type}
            onClick={() => onSelect(card.prompt, card.type)}
            className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface-secondary p-4 hover:border-accent/30 hover:bg-surface-tertiary transition-all text-left w-[170px]"
          >
            <span className="text-lg">{typeInfo?.icon || '📎'}</span>
            <span className="text-sm font-medium text-content-primary">{card.title}</span>
            <span className="text-xs text-content-tertiary line-clamp-2 leading-relaxed">{card.description}</span>
          </button>
        );
      })}
    </div>
  );
}

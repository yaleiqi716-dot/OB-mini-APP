'use client';

import { WORK_CARDS, TASK_TYPES } from '@/lib/constants';

interface WorkCardListProps {
  onSelect: (prompt: string, type: string) => void;
}

// SVG icon map — no emoji
function TaskIcon({ name }: { name: string }) {
  const s = {
    width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'chart':
      return <svg {...s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
    case 'globe':
      return <svg {...s}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
    case 'video':
      return <svg {...s}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;
    case 'mail':
      return <svg {...s}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
    case 'file':
      return <svg {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
    default:
      return <svg {...s}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
  }
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
            <span style={{ color: 'var(--text-muted)' }}>
              <TaskIcon name={typeInfo?.icon || 'file'} />
            </span>
            <span className="text-sm font-medium text-content-primary">{card.title}</span>
            <span className="text-xs text-content-tertiary line-clamp-2 leading-relaxed">{card.description}</span>
          </button>
        );
      })}
    </div>
  );
}

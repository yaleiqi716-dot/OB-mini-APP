'use client';

import { WORK_CARDS } from '@/lib/constants';
import { WorkCard } from './WorkCard';

interface WorkCardListProps {
  onSelect: (prompt: string, type: string) => void;
}

export function WorkCardList({ onSelect }: WorkCardListProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {WORK_CARDS.map((card) => (
        <WorkCard
          key={card.type}
          title={card.title}
          description={card.description}
          icon={WORK_CARDS.find((c) => c.type === card.type)?.title.charAt(0) === '制'
            ? '📊' : card.type === 'email' ? '✉️' : card.type === 'proposal' ? '📋' : card.type === 'website' ? '🌐' : '🎬'}
          onClick={() => onSelect(card.prompt, card.type)}
        />
      ))}
    </div>
  );
}

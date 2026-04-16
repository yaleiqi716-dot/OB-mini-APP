// Part of OrangeBench product internal design system
import { User } from "lucide-react";

export function UserMessage({ content, time }: { content: string; time?: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-raised text-text-muted">
        <User size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium text-text-muted">BOSS</span>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-[#F5F5F4] whitespace-pre-wrap">
          {content}
        </p>
        {time && <span className="mt-1 block text-[10px] text-text-subtle">{time}</span>}
      </div>
    </div>
  );
}

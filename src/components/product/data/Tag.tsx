// Part of OrangeBench product internal design system
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

/** Pill-shaped label tag — optional remove button. */
export interface TagProps {
  label: string;
  color?: string;
  onRemove?: () => void;
  className?: string;
}

export function Tag({ label, color, onRemove, className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-surface-raised px-2 py-0.5 text-xs text-text-muted",
        className
      )}
    >
      {color && (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span>{label}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 rounded p-0.5 text-text-subtle hover:text-[#F5F5F4] transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}

// Part of OrangeBench product internal design system
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Empty state — icon + title + description + optional CTA. */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      {icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-raised text-text-muted">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-[#F5F5F4]">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

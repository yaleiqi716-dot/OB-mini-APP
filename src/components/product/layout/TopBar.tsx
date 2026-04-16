// Part of OrangeBench product internal design system
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Page top bar — title/breadcrumb left, action buttons right. */
export interface TopBarProps {
  title?: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function TopBar({ title, breadcrumb, actions, className }: TopBarProps) {
  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center justify-between border-b border-border px-6",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        {breadcrumb || (
          <span className="font-medium text-[#F5F5F4]">{title}</span>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

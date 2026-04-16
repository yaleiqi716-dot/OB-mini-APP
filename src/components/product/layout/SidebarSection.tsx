// Part of OrangeBench product internal design system
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Sidebar group heading — uppercase mono label. */
export function SidebarSection({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-2 py-1", className)}>
      <div className="mb-1 px-2.5 pt-3 pb-1 font-mono text-[10px] font-medium uppercase tracking-widest text-text-subtle">
        {label}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

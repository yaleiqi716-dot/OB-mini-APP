// Part of OrangeBench product internal design system
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Standard page outer frame: TopBar slot + scrollable content + optional aside panel. */
export interface PageShellProps {
  topBar?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageShell({ topBar, aside, children, className }: PageShellProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {topBar}
      <div className="flex flex-1 overflow-hidden">
        <main
          className={cn(
            "flex-1 overflow-y-auto p-6 product-scrollbar",
            className
          )}
        >
          {children}
        </main>
        {aside && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-border p-4 product-scrollbar">
            {aside}
          </aside>
        )}
      </div>
    </div>
  );
}

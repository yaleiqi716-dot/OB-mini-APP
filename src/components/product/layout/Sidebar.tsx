// Part of OrangeBench product internal design system
"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Product sidebar shell — 240px expanded, 56px collapsed. */
export interface SidebarProps {
  collapsed?: boolean;
  children: ReactNode;
  className?: string;
}

export function Sidebar({ collapsed = false, children, className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-surface transition-[width] duration-slow ease-smooth",
        collapsed ? "w-14" : "w-60",
        className
      )}
    >
      {children}
    </aside>
  );
}

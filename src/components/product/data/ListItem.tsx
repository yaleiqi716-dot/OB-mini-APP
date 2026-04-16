// Part of OrangeBench product internal design system
import { cn } from "@/lib/utils";
import type { ReactNode, HTMLAttributes } from "react";

/** List row — h-10 compact, hover highlight, optional selected state. */
export interface ListItemProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  children: ReactNode;
}

export function ListItem({
  selected = false,
  className,
  children,
  ...props
}: ListItemProps) {
  return (
    <div
      role="listitem"
      className={cn(
        "flex h-10 cursor-pointer items-center gap-3 px-3 text-sm transition-colors duration-fast",
        selected
          ? "bg-accent-muted text-[#F5F5F4]"
          : "text-text-muted hover:bg-surface-overlay hover:text-[#F5F5F4]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Part of OrangeBench product internal design system
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Sidebar navigation item with icon, label, optional count badge. */
export interface SidebarItemProps {
  icon?: ReactNode;
  label: string;
  active?: boolean;
  count?: number;
  collapsed?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function SidebarItem({
  icon,
  label,
  active = false,
  count,
  collapsed = false,
  href,
  onClick,
  className,
}: SidebarItemProps) {
  const Tag = href ? "a" : "button";

  return (
    <Tag
      href={href}
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-fast",
        active
          ? "bg-accent-muted text-[#F5F5F4] font-medium"
          : "text-text-muted hover:bg-surface-overlay hover:text-[#F5F5F4]",
        collapsed && "justify-center px-0",
        className
      )}
    >
      {icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>}
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && count != null && count > 0 && (
        <span className="ml-auto text-xs text-text-subtle">{count}</span>
      )}
    </Tag>
  );
}

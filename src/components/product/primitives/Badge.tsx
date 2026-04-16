// Part of OrangeBench product internal design system
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

/** Compact badge/tag — text-xs with color variants. */
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "success" | "warning" | "danger";
}

const variants: Record<string, string> = {
  primary: "bg-primary/15 text-primary border-primary/20",
  secondary: "bg-surface-raised text-text-muted border-border",
  success: "bg-success/15 text-success border-success/20",
  warning: "bg-warning/15 text-warning border-warning/20",
  danger: "bg-danger/15 text-danger border-danger/20",
};

export function Badge({
  variant = "secondary",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

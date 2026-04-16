// Part of OrangeBench product internal design system
import { cn } from "@/lib/utils";

/** Animated shimmer placeholder block. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-raised", className)}
      {...props}
    />
  );
}

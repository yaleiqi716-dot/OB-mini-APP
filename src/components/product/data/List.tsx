// Part of OrangeBench product internal design system
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Linear-style compact list container. */
export function List({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="list"
      className={cn("flex flex-col divide-y divide-border", className)}
    >
      {children}
    </div>
  );
}

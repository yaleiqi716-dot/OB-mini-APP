// Part of OrangeBench product internal design system
import { Skeleton } from "./Skeleton";
import { cn } from "@/lib/utils";

/** Placeholder row for list loading states. */
export function LoadingRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-10 items-center gap-3 px-3", className)}>
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className="h-3 flex-1 max-w-[200px]" />
      <Skeleton className="ml-auto h-3 w-16" />
    </div>
  );
}

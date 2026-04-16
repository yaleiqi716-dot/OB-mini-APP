// Part of OrangeBench product internal design system
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

/** Error display with retry button. */
export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message = "Something went wrong",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-danger/10 text-danger">
        <AlertCircle size={18} />
      </div>
      <p className="text-sm text-text-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-accent-muted transition-colors duration-fast"
        >
          Retry
        </button>
      )}
    </div>
  );
}

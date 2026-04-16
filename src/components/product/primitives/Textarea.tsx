// Part of OrangeBench product internal design system
import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Product textarea — min-h-20 with auto-resize support. */
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[80px] w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-[#F5F5F4]",
      "placeholder:text-text-subtle",
      "transition-colors duration-fast",
      "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      className
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";

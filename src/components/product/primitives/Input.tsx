// Part of OrangeBench product internal design system
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Compact text input — h-8 text-sm with focus ring. */
export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-8 w-full rounded-md border border-border bg-surface px-3 text-sm text-[#F5F5F4]",
      "placeholder:text-text-subtle",
      "transition-colors duration-fast",
      "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      className
    )}
    {...props}
  />
));

Input.displayName = "Input";

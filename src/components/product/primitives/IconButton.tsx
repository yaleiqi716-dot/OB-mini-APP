// Part of OrangeBench product internal design system
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Icon-only button — h-8 w-8, hover reveals surface-overlay. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex h-8 w-8 items-center justify-center rounded-md",
      "text-text-muted hover:text-[#F5F5F4] hover:bg-surface-overlay",
      "transition-all duration-fast ease-smooth",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      "disabled:opacity-50 disabled:pointer-events-none",
      className
    )}
    {...props}
  />
));

IconButton.displayName = "IconButton";

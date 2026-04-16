// Part of OrangeBench product internal design system
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Compact product button — h-8 text-sm rounded-md by default. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium",
        "transition-all duration-150 ease-smooth",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:opacity-50 disabled:pointer-events-none",
        {
          "bg-primary text-[#F5F5F4] hover:bg-accent-hover": variant === "primary",
          "border border-border bg-transparent text-[#F5F5F4] hover:bg-surface-overlay": variant === "secondary",
          "text-text-muted hover:text-[#F5F5F4] hover:bg-surface-overlay": variant === "ghost",
          "bg-danger text-[#F5F5F4] hover:bg-danger/80": variant === "danger",
        },
        {
          "h-7 px-2.5 text-xs": size === "sm",
          "h-8 px-3 text-sm": size === "md",
        },
        className
      )}
      {...props}
    />
  )
);

Button.displayName = "Button";

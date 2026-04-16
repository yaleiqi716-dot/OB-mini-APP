// Part of OrangeBench product internal design system
"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

/** Compact select dropdown — h-8, dark theme. */
export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectGroup = SelectPrimitive.Group;

export const SelectTrigger = forwardRef<
  HTMLButtonElement,
  SelectPrimitive.SelectTriggerProps & { className?: string }
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex h-8 items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-sm text-[#F5F5F4]",
      "transition-colors duration-fast",
      "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      className
    )}
    {...props}
  >
    {children}
    <ChevronDown size={14} className="text-text-muted" />
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = forwardRef<
  HTMLDivElement,
  SelectPrimitive.SelectContentProps & { className?: string }
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position="popper"
      sideOffset={4}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-surface-raised p-1 shadow-lg",
        "animate-in fade-in-0 zoom-in-95",
        className
      )}
      {...props}
    >
      <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

export const SelectItem = forwardRef<
  HTMLDivElement,
  SelectPrimitive.SelectItemProps & { className?: string }
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-[#F5F5F4] outline-none",
      "data-[highlighted]:bg-surface-overlay",
      "data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemIndicator>
      <Check size={14} />
    </SelectPrimitive.ItemIndicator>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";

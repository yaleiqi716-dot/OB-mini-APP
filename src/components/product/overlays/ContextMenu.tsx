// Part of OrangeBench product internal design system
"use client";

import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

/** Right-click context menu — dark theme. */
export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

export const ContextMenuContent = forwardRef<
  HTMLDivElement,
  ContextMenuPrimitive.ContextMenuContentProps & { className?: string }
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-surface-raised p-1 shadow-lg",
        "animate-in fade-in-0 zoom-in-95",
        className
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
));
ContextMenuContent.displayName = "ContextMenuContent";

export const ContextMenuItem = forwardRef<
  HTMLDivElement,
  ContextMenuPrimitive.ContextMenuItemProps & { className?: string; destructive?: boolean }
>(({ className, destructive = false, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      "flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm outline-none",
      destructive
        ? "text-danger focus:bg-danger/10"
        : "text-[#F5F5F4] focus:bg-surface-overlay",
      "data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
      className
    )}
    {...props}
  />
));
ContextMenuItem.displayName = "ContextMenuItem";

export const ContextMenuSeparator = forwardRef<
  HTMLDivElement,
  ContextMenuPrimitive.ContextMenuSeparatorProps & { className?: string }
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn("my-1 h-px bg-border", className)}
    {...props}
  />
));
ContextMenuSeparator.displayName = "ContextMenuSeparator";

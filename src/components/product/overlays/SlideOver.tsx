// Part of OrangeBench product internal design system
"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { forwardRef, type ReactNode } from "react";

/** Right-side slide-over panel — built on Radix Dialog for a11y. */
export const SlideOver = DialogPrimitive.Root;
export const SlideOverTrigger = DialogPrimitive.Trigger;
export const SlideOverClose = DialogPrimitive.Close;

export const SlideOverContent = forwardRef<
  HTMLDivElement,
  DialogPrimitive.DialogContentProps & { className?: string; children: ReactNode }
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0C0C0A]/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-xl",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        "duration-150",
        className
      )}
      {...props}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div />
        <DialogPrimitive.Close className="rounded-md p-1 text-text-muted hover:text-[#F5F5F4] transition-colors">
          <X size={16} />
        </DialogPrimitive.Close>
      </div>
      <div className="flex-1 overflow-y-auto p-4 product-scrollbar">
        {children}
      </div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SlideOverContent.displayName = "SlideOverContent";

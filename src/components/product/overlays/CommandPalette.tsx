// Part of OrangeBench product internal design system
"use client";

import { Command } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { forwardRef, type ReactNode } from "react";

/** Cmd+K command palette — built on cmdk + Radix Dialog. */
export function CommandPalette({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0C0C0A]/60 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-border bg-surface shadow-2xl overflow-hidden">
          <Command className="flex flex-col">
            {children}
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function CommandInput({ className, ...props }: React.ComponentProps<typeof Command.Input>) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3">
      <Search size={16} className="shrink-0 text-text-muted" />
      <Command.Input
        className={cn(
          "h-11 w-full bg-transparent text-sm text-[#F5F5F4] placeholder:text-text-subtle outline-none",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function CommandList({ className, ...props }: React.ComponentProps<typeof Command.List>) {
  return (
    <Command.List
      className={cn("max-h-72 overflow-y-auto p-1 product-scrollbar", className)}
      {...props}
    />
  );
}

export function CommandEmpty({ className, ...props }: React.ComponentProps<typeof Command.Empty>) {
  return (
    <Command.Empty
      className={cn("py-6 text-center text-sm text-text-muted", className)}
      {...props}
    />
  );
}

export function CommandGroup({ className, heading, ...props }: React.ComponentProps<typeof Command.Group>) {
  return (
    <Command.Group
      heading={heading}
      className={cn(
        "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-text-subtle",
        className
      )}
      {...props}
    />
  );
}

export const CommandItem = forwardRef<HTMLDivElement, React.ComponentProps<typeof Command.Item>>(
  ({ className, ...props }, ref) => (
    <Command.Item
      ref={ref}
      className={cn(
        "flex h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-[#F5F5F4] outline-none",
        "data-[selected=true]:bg-surface-overlay",
        "data-[disabled=true]:opacity-50 data-[disabled=true]:pointer-events-none",
        className
      )}
      {...props}
    />
  )
);
CommandItem.displayName = "CommandItem";

export function CommandSeparator({ className, ...props }: React.ComponentProps<typeof Command.Separator>) {
  return <Command.Separator className={cn("my-1 h-px bg-border", className)} {...props} />;
}

// Part of OrangeBench product internal design system
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function SidebarNewChatButton({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <div className={cn("shrink-0 py-3", collapsed ? "px-2" : "px-3")}>
      <button
        onClick={onClick}
        className={cn(
          "focus-ring flex w-full items-center gap-2 rounded-md bg-primary text-sm font-medium text-[#F5F5F4] transition-all duration-base hover:bg-accent-hover",
          collapsed ? "h-9 w-9 justify-center mx-auto" : "h-9 px-3"
        )}
      >
        <Plus size={16} className="shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">新建对话</span>
            <kbd className="text-[10px] font-normal text-[#F5F5F4]/50">⌘N</kbd>
          </>
        )}
      </button>
    </div>
  );
}

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
    <div className="shrink-0 px-3 py-3">
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-[#F5F5F4] transition-all duration-base hover:bg-accent-hover",
          collapsed ? "h-9 w-9 mx-auto rounded-md" : "h-9 px-3"
        )}
      >
        <Plus size={16} />
        {!collapsed && <span>新建对话</span>}
      </button>
    </div>
  );
}

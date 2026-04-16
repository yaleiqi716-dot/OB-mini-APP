// Part of OrangeBench product internal design system
import { Share2, Settings2 } from "lucide-react";
import { AgentWelcomeScreen } from "./AgentWelcomeScreen";

export function AgentMainContent() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* TopBar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-6">
        <span className="text-sm font-medium text-[#F5F5F4]">新对话</span>
        <div className="flex items-center gap-1">
          <button className="focus-ring flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors duration-fast hover:bg-surface-overlay hover:text-[#F5F5F4]">
            <Share2 size={16} />
          </button>
          <button className="focus-ring flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors duration-fast hover:bg-surface-overlay hover:text-[#F5F5F4]">
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-y-auto product-scrollbar">
        <AgentWelcomeScreen />
      </div>
    </div>
  );
}

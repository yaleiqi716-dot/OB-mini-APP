// Part of OrangeBench product internal design system
"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarWorkspaceSwitcher } from "./SidebarWorkspaceSwitcher";
import { SidebarNewChatButton } from "./SidebarNewChatButton";
import { SidebarConversationList } from "./SidebarConversationList";
import { SidebarUserMenu } from "./SidebarUserMenu";

export function AgentSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>("c1");

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col border-r border-border bg-surface transition-[width] duration-base ease-smooth",
        collapsed ? "w-14" : "w-[260px]"
      )}
    >
      <SidebarWorkspaceSwitcher collapsed={collapsed} />
      <SidebarNewChatButton
        collapsed={collapsed}
        onClick={() => setActiveConvId(null)}
      />

      {!collapsed && (
        <div className="px-4 pb-1 pt-2 text-[10px] font-medium uppercase tracking-widest text-text-subtle">
          最近对话
        </div>
      )}

      <SidebarConversationList
        collapsed={collapsed}
        activeId={activeConvId}
        onSelect={setActiveConvId}
      />

      <SidebarUserMenu collapsed={collapsed} />

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 bottom-16 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-text-muted shadow-sm transition-colors duration-fast hover:bg-surface-overlay hover:text-[#F5F5F4]"
      >
        {collapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}
      </button>
    </aside>
  );
}

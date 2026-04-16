// Part of OrangeBench product internal design system
"use client";

import { memo, useState } from "react";
import { MessageSquare, MoreHorizontal, Pencil, Trash2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Conversation } from "./types";

const MENU_ITEMS = [
  { icon: Pencil, label: "重命名", danger: false },
  { icon: Share2, label: "分享", danger: false },
  { icon: Trash2, label: "删除", danger: true },
] as const;

export const SidebarConversationItem = memo(function SidebarConversationItem({
  conversation,
  active = false,
  collapsed = false,
  onClick,
}: {
  conversation: Conversation;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={cn(
          "focus-ring flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-sm transition-colors duration-fast",
          active
            ? "bg-accent-muted border-l-2 border-primary pl-1.5 font-medium text-[#F5F5F4]"
            : "text-text-muted hover:bg-surface-overlay hover:text-[#F5F5F4]",
          collapsed && "justify-center px-0"
        )}
      >
        <MessageSquare size={14} className="shrink-0" />
        {!collapsed && (
          <span className="flex-1 truncate text-left">{conversation.title}</span>
        )}
      </button>

      {!collapsed && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-fast group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="focus-ring flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-[#F5F5F4] hover:bg-surface-overlay"
          >
            <MoreHorizontal size={14} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-7 z-50 min-w-[140px] rounded-lg border border-border bg-surface-raised p-1 shadow-lg">
                {MENU_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-fast",
                      item.danger
                        ? "text-danger hover:bg-danger/10"
                        : "text-[#F5F5F4] hover:bg-surface-overlay"
                    )}
                  >
                    <item.icon size={14} />
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});

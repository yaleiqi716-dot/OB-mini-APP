// Part of OrangeBench product internal design system
"use client";

import { useState } from "react";
import { Settings, CreditCard, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserProfile } from "./types";

const mockUser: UserProfile = {
  name: "BOSS",
  email: "boss@orangebench.tech",
};

export function SidebarUserMenu({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0 border-t border-border px-3 py-2">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-fast hover:bg-surface-overlay",
          collapsed && "justify-center px-0"
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-medium text-text-muted">
          {mockUser.name[0]}
        </span>
        {!collapsed && (
          <>
            <div className="flex flex-1 flex-col items-start overflow-hidden">
              <span className="truncate text-sm font-medium text-[#F5F5F4]">{mockUser.name}</span>
              <span className="truncate text-[11px] text-text-muted">{mockUser.email}</span>
            </div>
            <Settings size={14} className="shrink-0 text-text-muted" />
          </>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-2 right-2 z-50 mb-1 rounded-lg border border-border bg-surface-raised p-1 shadow-lg">
            {[
              { icon: Settings, label: "账户设置", href: "/account" },
              { icon: CreditCard, label: "订阅", href: "/billing" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#F5F5F4] transition-colors duration-fast hover:bg-surface-overlay"
              >
                <item.icon size={14} />
                {item.label}
              </a>
            ))}
            <div className="my-1 h-px bg-border" />
            <button
              onClick={() => { console.log("logout"); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-danger transition-colors duration-fast hover:bg-danger/10"
            >
              <LogOut size={14} />
              退出登录
            </button>
          </div>
        </>
      )}
    </div>
  );
}

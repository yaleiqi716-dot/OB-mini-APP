// Part of OrangeBench product internal design system
"use client";

import { useState } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Workspace } from "./types";

const MOCK_WORKSPACES: Workspace[] = [
  { id: "1", name: "OrangeBench", active: true },
  { id: "2", name: "个人项目", active: false },
];

export function SidebarWorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState(MOCK_WORKSPACES);
  const active = workspaces.find((w) => w.active) ?? workspaces[0];

  function switchTo(id: string) {
    setWorkspaces((prev) =>
      prev.map((w) => ({ ...w, active: w.id === id }))
    );
    setOpen(false);
  }

  return (
    <div className="relative flex h-14 shrink-0 items-center border-b border-border px-2">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "focus-ring flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium text-[#F5F5F4] transition-colors duration-fast hover:bg-surface-overlay",
          collapsed && "justify-center px-0"
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
          {active.name[0]}
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{active.name}</span>
            <ChevronsUpDown size={14} className="shrink-0 text-text-muted" />
          </>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-2 right-2 top-[52px] z-50 rounded-lg border border-border bg-surface-raised p-1 shadow-lg">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => switchTo(ws.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#F5F5F4] transition-colors duration-fast hover:bg-surface-overlay"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold bg-primary/15 text-primary">
                  {ws.name[0]}
                </span>
                <span className="flex-1 truncate text-left">{ws.name}</span>
                {ws.active && <Check size={14} className="text-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

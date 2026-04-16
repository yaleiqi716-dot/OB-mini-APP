// Part of OrangeBench product internal design system
"use client";

import { useCallback, useEffect, useState } from "react";
import { AgentSidebar } from "./AgentSidebar";
import { AgentMainContent } from "./AgentMainContent";

const SIDEBAR_KEY = "orangebench.agent.sidebar.collapsed";

export function AgentAppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Restore sidebar state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_KEY);
      if (stored === "1") setSidebarCollapsed(true);
    } catch {}
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === "/") {
        e.preventDefault();
        toggleSidebar();
      }
      if (e.key === "k") {
        e.preventDefault();
        console.log("[shortcut] open command palette");
      }
      if (e.key === "n") {
        e.preventDefault();
        console.log("[shortcut] new chat");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-[#F5F5F4]">
      <AgentSidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <AgentMainContent />
    </div>
  );
}

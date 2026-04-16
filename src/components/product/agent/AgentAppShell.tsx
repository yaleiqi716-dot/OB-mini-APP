// Part of OrangeBench product internal design system
"use client";

import { AgentSidebar } from "./AgentSidebar";
import { AgentMainContent } from "./AgentMainContent";

export function AgentAppShell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-[#F5F5F4]">
      <AgentSidebar />
      <AgentMainContent />
    </div>
  );
}

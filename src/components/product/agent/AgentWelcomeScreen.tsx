// Part of OrangeBench product internal design system
"use client";

import { AgentPromptInput } from "./AgentPromptInput";
import { QuickActionCards } from "./QuickActionCards";

export function AgentWelcomeScreen() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-10 px-6 bg-background">
      {/* Title group */}
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-[32px] font-semibold leading-[1.15] tracking-tight text-[#F5F5F4] text-center md:text-[40px]">
          告诉我任务，<span className="text-primary">推进到完成</span>
        </h1>
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-text-muted text-center md:text-[13px]">
          UNDERSTAND &middot; DECOMPOSE &middot; EXECUTE &middot; DELIVER &middot; COLLABORATE
        </p>
      </div>

      {/* Prompt input with AGENT badge */}
      <AgentPromptInput />

      {/* Quick action cards */}
      <QuickActionCards />
    </div>
  );
}

// Part of OrangeBench product internal design system
"use client";

import { AgentPromptInput } from "./AgentPromptInput";
import { QuickActionCards } from "./QuickActionCards";

export function AgentWelcomeScreen() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 bg-background">
      {/* Title group — replicated from /agent-legacy */}
      <div className="flex flex-col items-center text-center">
        <h1 className="ob-hero-title" style={{ marginBottom: 12 }}>
          告诉我任务，<span className="ob-hero-accent">推进到完成</span>
        </h1>
        <p
          style={{
            fontFamily: "var(--ob-font-mono)",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ob-text-muted)",
            textAlign: "center",
            marginBottom: 32,
            maxWidth: 520,
          }}
        >
          UNDERSTAND · DECOMPOSE · EXECUTE · DELIVER · COLLABORATE
        </p>
      </div>

      {/* Prompt input with AGENT badge */}
      <AgentPromptInput />

      {/* Quick action cards */}
      <div className="w-full max-w-2xl" style={{ marginTop: 32 }}>
        <QuickActionCards />
      </div>
    </div>
  );
}

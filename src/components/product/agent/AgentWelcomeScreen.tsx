// Part of OrangeBench product internal design system
"use client";

import { useState, useEffect, useCallback } from "react";
import { AgentPromptInput } from "./AgentPromptInput";
import { AgentBackgroundFX } from "./AgentBackgroundFX";

const SESSION_KEY = "orangebench.agent.intro.played";

function useIntroAnimation() {
  const [mode, setMode] = useState<"animate" | "static">("static");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const played = sessionStorage.getItem(SESSION_KEY);
    if (!played) setMode("animate");
  }, []);

  const handleAnimationEnd = useCallback(() => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setMode("static");
  }, []);

  const replay = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setMode("animate");
  }, []);

  return { mode, handleAnimationEnd, replay };
}

export function AgentWelcomeScreen() {
  const { mode, handleAnimationEnd, replay } = useIntroAnimation();

  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center px-6">
      {/* Background FX layer */}
      <AgentBackgroundFX mode={mode} onAnimationEnd={handleAnimationEnd} />

      {/* Foreground content */}
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
        {/* Title */}
        <h1
          className="mb-4 text-center text-3xl font-semibold leading-[1.2] tracking-tight text-[#F5F5F4] md:text-[42px]"
          style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
        >
          告诉我任务，<span className="text-primary">推进到完成</span>
        </h1>

        {/* Value proposition */}
        <p className="mb-12 text-center text-[11px] font-medium tracking-[0.35em] text-text-muted uppercase md:text-xs">
          UNDERSTAND &middot; DECOMPOSE &middot; EXECUTE &middot; DELIVER &middot; COLLABORATE
        </p>

        {/* Prompt input */}
        <AgentPromptInput />
      </div>

      {/* DEV ONLY: replay button */}
      {process.env.NODE_ENV === "development" && (
        <button
          onClick={replay}
          className="fixed bottom-4 right-4 z-50 rounded-md bg-surface-overlay px-2 py-1 text-xs text-text-subtle hover:text-[#F5F5F4] transition-colors"
        >
          重播背景
        </button>
      )}
    </div>
  );
}

// Part of OrangeBench product internal design system
import { AgentPromptInput } from "./AgentPromptInput";

export function AgentWelcomeScreen() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6">
      {/* Title */}
      <h1 className="mb-4 text-center text-3xl font-semibold leading-[1.2] tracking-tight text-[#F5F5F4] md:text-[42px]">
        告诉我任务，<span className="text-primary">推进到完成</span>
      </h1>

      {/* Value proposition */}
      <p className="mb-12 text-center text-[11px] font-medium tracking-[0.35em] text-text-muted uppercase md:text-xs">
        UNDERSTAND &middot; DECOMPOSE &middot; EXECUTE &middot; DELIVER &middot; COLLABORATE
      </p>

      {/* Prompt input with AGENT badge */}
      <AgentPromptInput />
    </div>
  );
}

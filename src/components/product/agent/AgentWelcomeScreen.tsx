// Part of OrangeBench product internal design system
import { AgentPromptInput } from "./AgentPromptInput";

export function AgentWelcomeScreen() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6">
      {/* Title */}
      <h1 className="mb-4 text-center text-4xl font-bold text-[#F5F5F4] md:text-5xl">
        告诉我任务，<span className="text-primary">推进到完成</span>
      </h1>

      {/* Value proposition */}
      <p className="mb-12 text-center text-xs tracking-[0.2em] text-text-subtle uppercase md:text-sm">
        UNDERSTAND &middot; DECOMPOSE &middot; EXECUTE &middot; DELIVER &middot; COLLABORATE
      </p>

      {/* Prompt input */}
      <AgentPromptInput />
    </div>
  );
}

// Part of OrangeBench product internal design system
"use client";

import { AgentPromptInput } from "../AgentPromptInput";

export function ConversationInput({ conversationId }: { conversationId: string }) {
  return (
    <div className="shrink-0 border-t border-border px-6 py-4">
      <AgentPromptInput conversationId={conversationId} />
    </div>
  );
}

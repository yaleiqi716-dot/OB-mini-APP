// Part of OrangeBench product internal design system
"use client";

import { ConversationTopBar } from "./ConversationTopBar";
import { MessageList } from "./MessageList";
import { ConversationInput } from "./ConversationInput";

interface Props {
  conversationId: string;
}

export function AgentConversationView({ conversationId }: Props) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ConversationTopBar conversationId={conversationId} />
      <MessageList conversationId={conversationId} />
      <ConversationInput conversationId={conversationId} />
    </div>
  );
}

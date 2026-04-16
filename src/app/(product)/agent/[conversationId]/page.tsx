'use client';

import { AgentAppShell } from '@/components/product/agent/AgentAppShell';
import { AgentConversationView } from '@/components/product/agent/conversation/AgentConversationView';

export default function ConversationPage({
  params,
}: {
  params: { conversationId: string };
}) {
  return (
    <AgentAppShell>
      <AgentConversationView conversationId={params.conversationId} />
    </AgentAppShell>
  );
}

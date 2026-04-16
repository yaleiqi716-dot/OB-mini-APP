// Part of OrangeBench product internal design system
import { MessageSquare } from "lucide-react";

export function MessageList({ conversationId }: { conversationId: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center product-scrollbar">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-raised text-text-muted">
        <MessageSquare size={18} />
      </div>
      <p className="mt-3 text-sm text-text-muted">消息加载中...</p>
    </div>
  );
}

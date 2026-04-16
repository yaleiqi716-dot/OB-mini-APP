// Part of OrangeBench product internal design system
"use client";

import { useEffect, useState } from "react";
import { Share2, Settings2 } from "lucide-react";

export function ConversationTopBar({ conversationId }: { conversationId: string }) {
  const [title, setTitle] = useState("加载中...");

  useEffect(() => {
    fetch(`/api/conversations/${conversationId}/tasks`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const firstInput = (data[0].input as string) || "";
          setTitle(firstInput.slice(0, 30) || "对话");
        } else {
          setTitle("新对话");
        }
      })
      .catch(() => setTitle("对话"));
  }, [conversationId]);

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-6">
      <span className="max-w-[400px] truncate text-sm font-medium text-[#F5F5F4]">
        {title}
      </span>
      <div className="flex items-center gap-1">
        <button className="focus-ring flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors duration-fast hover:bg-surface-overlay hover:text-[#F5F5F4]">
          <Share2 size={16} />
        </button>
        <button className="focus-ring flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors duration-fast hover:bg-surface-overlay hover:text-[#F5F5F4]">
          <Settings2 size={16} />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SubmitParams {
  input: string;
  skillRoleId?: string;
  attachments?: Array<{ id: string; name: string; size: number; type: string }>;
  conversationId?: string;
}

interface SubmitResult {
  taskId: string;
  conversationId: string;
}

export function useTaskSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(params: SubmitParams): Promise<SubmitResult | null> {
    setIsSubmitting(true);
    setError(null);

    try {
      let convId = params.conversationId;

      // Step 1: Create conversation if none
      if (!convId) {
        const convRes = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: params.input.slice(0, 40) }),
        });
        if (!convRes.ok) {
          const d = await convRes.json().catch(() => ({}));
          if (convRes.status === 401) { router.push("/login"); return null; }
          throw new Error(d.error || "创建会话失败");
        }
        const convData = await convRes.json();
        convId = convData.id;
      }

      // Step 2: Submit task
      const taskRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: params.input,
          conversationId: convId,
          skillRoleId: params.skillRoleId || undefined,
          attachments: params.attachments?.length ? params.attachments : undefined,
          source: "agent",
        }),
      });

      if (!taskRes.ok) {
        const d = await taskRes.json().catch(() => ({}));
        if (taskRes.status === 401) { router.push("/login"); return null; }
        throw new Error(d.error || "提交失败，请重试");
      }

      const taskData = await taskRes.json();
      const result = { taskId: taskData.taskId, conversationId: convId! };

      // Step 3: Navigate to conversation
      router.push(`/agent/${result.conversationId}`);

      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "提交失败";
      setError(msg);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { submit, isSubmitting, error };
}

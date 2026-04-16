// Part of OrangeBench product internal design system
"use client";

import { useState } from "react";
import { Bot, Copy, Check, RefreshCw, AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Typewriter } from "./Typewriter";

interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export function AgentResponse({
  status,
  thinkingText,
  result,
  resultType,
  error,
}: {
  status: string;
  thinkingText: string | null;
  result: Record<string, unknown> | null;
  resultType?: string;
  error?: string;
}) {
  const isActive = !["completed", "failed"].includes(status);

  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bot size={14} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <span className="text-xs font-medium text-text-muted">Agent</span>

        {/* Thinking */}
        {isActive && thinkingText && (
          <div className="pl-3 border-l-2 border-primary/15">
            <p className="text-sm italic text-text-muted leading-relaxed">
              <Typewriter text={thinkingText} speed={20} />
            </p>
          </div>
        )}

        {/* Active with no thinking yet */}
        {isActive && !thinkingText && (
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-text-muted animate-pulse">正在处理...</span>
          </div>
        )}

        {/* Completed result */}
        {status === "completed" && result && (
          <ResultDisplay result={result} resultType={resultType} />
        )}

        {/* Failed */}
        {status === "failed" && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-danger" />
            <div>
              <p className="text-sm text-danger">{error || "任务执行失败"}</p>
              <button className="mt-1 text-xs text-primary hover:underline">重试</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultDisplay({
  result,
  resultType,
}: {
  result: Record<string, unknown>;
  resultType?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const textContent =
    (result.text || result.content || result.message || result.summary) as string | undefined;
  const isTextType = !resultType || resultType === "text" || resultType === "direct" || resultType === "unknown";

  function handleCopy() {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Non-text types: show preview placeholder
  if (!isTextType && resultType) {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-border-subtle bg-surface-raised px-4 py-3">
          <p className="text-sm text-text-muted">
            类型 <span className="font-mono text-text-subtle">{resultType}</span> 预览开发中，可查看原始文本
          </p>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ChevronDown size={12} className={cn("transition-transform", expanded && "rotate-180")} />
            {expanded ? "收起" : "展开原始内容"}
          </button>
        </div>
        {expanded && textContent && (
          <div className="rounded-lg border border-border-subtle bg-surface px-4 py-3">
            <p className="text-sm text-text-muted whitespace-pre-wrap leading-relaxed">{textContent}</p>
          </div>
        )}
      </div>
    );
  }

  if (!textContent) {
    return <p className="text-sm text-text-muted">任务已完成</p>;
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border-subtle bg-surface px-4 py-3">
        <p className="text-sm text-[#F5F5F4] whitespace-pre-wrap leading-relaxed">{textContent}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100">
        <button onClick={handleCopy} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-overlay transition-colors">
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
    </div>
  );
}

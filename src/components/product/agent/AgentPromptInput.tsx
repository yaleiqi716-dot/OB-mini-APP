// Part of OrangeBench product internal design system
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttachmentButton } from "./prompt-input/AttachmentButton";
import { RoleSelector } from "./prompt-input/RoleSelector";
import { ModelSelector } from "./prompt-input/ModelSelector";
import { MCPToolSelector } from "./prompt-input/MCPToolSelector";
import { PLACEHOLDER_EXAMPLES } from "./prompt-input/mock-data";

function randomPlaceholder() {
  return PLACEHOLDER_EXAMPLES[Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.length)];
}

export function AgentPromptInput({
  isSubmitting = false,
}: {
  isSubmitting?: boolean;
}) {
  const [text, setText] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [modelId, setModelId] = useState("gpt-4o");
  const [mcpCount, setMcpCount] = useState(0);
  const [placeholder] = useState(randomPlaceholder);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, []);

  useEffect(() => resize(), [text, resize]);
  useEffect(() => { textareaRef.current?.focus(); }, []);

  const disabled = isSubmitting;
  const canSubmit = text.trim().length > 0 && !disabled;
  const charCount = text.length;

  function handleSubmit() {
    if (!canSubmit) return;
    console.log("[submit]", { text: text.trim(), roleId, modelId, mcpCount });
    setText("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setText(""); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }

  return (
    <div className="w-full max-w-2xl">
      {/* AGENT badge — tab-style, fused to input top-left */}
      <div className="flex items-center">
        <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-border-subtle bg-surface/80 backdrop-blur-xl px-3 py-1.5 relative z-10 -mb-px">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-semibold tracking-[0.15em] text-primary">AGENT</span>
          <span className="text-text-subtle text-xs">&middot;</span>
          <span className="text-xs text-text-muted">输入任务</span>
          {mcpCount > 0 && (
            <>
              <span className="text-text-subtle text-xs">&middot;</span>
              <span className="text-xs text-text-muted">{mcpCount} 个技能</span>
            </>
          )}
        </div>
      </div>

      {/* Input box — top-left corner square to fuse with badge */}
      <div
        className={cn(
          "rounded-tr-xl rounded-bl-xl rounded-br-xl border bg-surface/80 backdrop-blur-xl p-4 shadow-lg shadow-black/20",
          "transition-all duration-base ease-smooth",
          "border-border-subtle focus-within:border-border-strong focus-within:ring-1 focus-within:ring-primary/20"
        )}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full resize-none bg-transparent text-base text-[#F5F5F4] placeholder:text-text-subtle outline-none disabled:opacity-50"
          style={{ minHeight: 72, maxHeight: 240 }}
        />

        <div className="my-3 border-t border-border-subtle" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AttachmentButton disabled={disabled} />
            <RoleSelector value={roleId} onChange={setRoleId} disabled={disabled} />
            <ModelSelector value={modelId} onChange={setModelId} disabled={disabled} />
            <MCPToolSelector selectedCount={mcpCount} onSelectedCountChange={setMcpCount} disabled={disabled} />
          </div>
          <div className="flex items-center gap-2">
            {charCount > 0 && (
              <span className="text-[11px] tabular-nums text-text-subtle">{charCount}</span>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                "focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-fast",
                canSubmit
                  ? "bg-primary text-[#F5F5F4] hover:bg-accent-hover"
                  : "bg-surface-overlay text-text-subtle cursor-not-allowed"
              )}
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className={cn(
        "mt-2 text-center text-xs text-text-subtle transition-opacity duration-fast",
        focused ? "opacity-100" : "opacity-0"
      )}>
        Enter 发送 &middot; Shift + Enter 换行
      </div>
    </div>
  );
}

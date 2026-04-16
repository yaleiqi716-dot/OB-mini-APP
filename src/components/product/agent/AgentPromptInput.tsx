// Part of OrangeBench product internal design system
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttachmentButton } from "./prompt-input/AttachmentButton";
import { RoleSelector } from "./prompt-input/RoleSelector";
import { ModelSelector } from "./prompt-input/ModelSelector";
import { PLACEHOLDER_EXAMPLES } from "./prompt-input/mock-data";

function randomPlaceholder() {
  return PLACEHOLDER_EXAMPLES[Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.length)];
}

export function AgentPromptInput() {
  const [text, setText] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [modelId, setModelId] = useState("gpt-4o");
  const [placeholder] = useState(randomPlaceholder);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, []);

  useEffect(() => resize(), [text, resize]);

  // Autofocus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const canSubmit = text.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    console.log("[submit]", { text: text.trim(), roleId, modelId });
    setText("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div
      className={cn(
        "w-full max-w-2xl rounded-xl border bg-surface p-4 shadow-lg shadow-black/20",
        "transition-all duration-base ease-smooth",
        "border-border-subtle focus-within:border-border-strong focus-within:ring-1 focus-within:ring-primary/20"
      )}
    >
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        className="w-full resize-none bg-transparent text-base text-[#F5F5F4] placeholder:text-text-subtle outline-none"
        style={{ minHeight: 72, maxHeight: 240 }}
      />

      {/* Divider */}
      <div className="my-3 border-t border-border-subtle" />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AttachmentButton />
          <RoleSelector value={roleId} onChange={setRoleId} />
          <ModelSelector value={modelId} onChange={setModelId} />
        </div>
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
          <ArrowUp size={16} />
        </button>
      </div>
    </div>
  );
}

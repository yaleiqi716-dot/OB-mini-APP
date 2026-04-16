// Part of OrangeBench product internal design system
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, FileIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskSubmit } from "@/hooks/useTaskSubmit";
import { useFileUpload } from "@/hooks/useFileUpload";
import { AttachmentButton } from "./prompt-input/AttachmentButton";
import { RoleSelector } from "./prompt-input/RoleSelector";
import { ModelSelector } from "./prompt-input/ModelSelector";
import { MCPToolSelector } from "./prompt-input/MCPToolSelector";
import { PLACEHOLDER_EXAMPLES } from "./prompt-input/mock-data";

function randomPlaceholder() {
  return PLACEHOLDER_EXAMPLES[Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.length)];
}

export function AgentPromptInput({
  conversationId,
}: {
  conversationId?: string;
}) {
  const [text, setText] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [modelId, setModelId] = useState("gpt-4o");
  const [mcpCount, setMcpCount] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [placeholder] = useState(randomPlaceholder);
  const [focused, setFocused] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { submit, isSubmitting, error: submitError } = useTaskSubmit();
  const { uploadFiles, uploading } = useFileUpload();

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, []);

  useEffect(() => resize(), [text, resize]);
  useEffect(() => { textareaRef.current?.focus(); }, []);

  useEffect(() => {
    if (submitError) {
      setToast(submitError);
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [submitError]);

  const busy = isSubmitting || uploading;
  const canSubmit = (text.trim().length > 0 || files.length > 0) && !busy;
  const charCount = text.length;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function addFiles(newFiles: File[]) {
    const valid = newFiles.filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        showToast(`${f.name} 超出 10MB 限制`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!canSubmit) return;

    let attachments: { id: string; name: string; size: number; type: string }[] | undefined;
    if (files.length > 0) {
      const { uploaded, errors } = await uploadFiles(files);
      for (const err of errors) showToast(err);
      if (uploaded.length > 0) attachments = uploaded;
    }

    await submit({
      input: text.trim(),
      skillRoleId: roleId || undefined,
      attachments,
      conversationId,
    });

    setText("");
    setFiles([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setText(""); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }

  return (
    <div className="w-full max-w-2xl">
      {/* AGENT badge */}
      <div className="inline-flex items-center gap-2 py-1 mb-2 pl-4">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        <span className="text-[10px] font-semibold tracking-[0.15em] text-primary">AGENT</span>
        <span className="text-[10px] text-text-subtle">&middot;</span>
        <span className="text-[10px] text-text-muted">输入任务</span>
        {mcpCount > 0 && (
          <>
            <span className="text-[10px] text-text-subtle">&middot;</span>
            <span className="text-[10px] text-text-muted">{mcpCount} 个技能</span>
          </>
        )}
      </div>

      {/* Input box */}
      <div
        className={cn(
          "rounded-lg border bg-surface p-4 shadow-lg shadow-black/20",
          "transition-all duration-base ease-smooth",
          focused ? "border-border-strong ring-1 ring-primary/20" : "border-border-subtle"
        )}
      >
        {/* File chips */}
        {files.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center gap-1.5 rounded-md bg-surface-overlay px-2 py-1 text-xs text-text-muted"
              >
                <FileIcon size={12} className="shrink-0" />
                <span className="max-w-[160px] truncate">{f.name}</span>
                <span className="text-text-subtle">{(f.size / 1024).toFixed(0)}KB</span>
                {uploading ? (
                  <Loader2 size={12} className="animate-spin text-text-subtle" />
                ) : (
                  <button onClick={() => removeFile(i)} className="text-text-subtle hover:text-[#F5F5F4] transition-colors">
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={busy}
          rows={1}
          className="w-full resize-none bg-transparent text-base text-[#F5F5F4] placeholder:text-text-subtle outline-none disabled:opacity-50"
          style={{ minHeight: 72, maxHeight: 240 }}
        />

        <div className="my-3 border-t border-border-subtle" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AttachmentButton disabled={busy} onFilesSelected={addFiles} />
            <RoleSelector value={roleId} onChange={setRoleId} disabled={busy} />
            <ModelSelector value={modelId} onChange={setModelId} disabled={busy} />
            <MCPToolSelector selectedCount={mcpCount} onSelectedCountChange={setMcpCount} disabled={busy} />
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
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-danger/90 px-4 py-2 text-sm text-[#F5F5F4] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

// Part of OrangeBench product internal design system
"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_MODELS } from "./mock-data";

export function ModelSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = MOCK_MODELS.find((m) => m.id === value) ?? MOCK_MODELS[0];

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="focus-ring flex h-8 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-overlay px-2.5 text-xs text-[#F5F5F4] transition-colors duration-fast disabled:opacity-50 disabled:pointer-events-none"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span>{selected.name}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-lg border border-border bg-surface-raised p-1 shadow-lg">
            {MOCK_MODELS.map((model) => {
              const isSelected = value === model.id;
              return (
                <button
                  key={model.id}
                  onClick={() => {
                    onChange(model.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors duration-fast",
                    isSelected ? "bg-accent-muted" : "hover:bg-surface-overlay"
                  )}
                >
                  <span className="w-4 shrink-0">
                    {isSelected && <Check size={14} className="text-primary" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[#F5F5F4]">{model.name}</span>
                    <span className="ml-2 text-xs text-text-muted">{model.desc}</span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                      model.tier === "free"
                        ? "bg-surface-overlay text-text-subtle"
                        : "bg-primary/15 text-primary"
                    )}
                  >
                    {model.tier}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Part of OrangeBench product internal design system
"use client";

import { useEffect, useState, useRef } from "react";
import {
  ChevronDown, PenLine, BarChart3, Palette, ListChecks,
  Code2, Handshake, Users, Calculator, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_ROLES } from "./mock-data";

const ICONS: Record<string, React.ElementType> = {
  PenLine, BarChart3, Palette, ListChecks, Code2,
  HandshakeIcon: Handshake, Users, Calculator,
};

export function RoleSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = MOCK_ROLES.find((r) => r.id === value);

  const filtered = query
    ? MOCK_ROLES.filter(
        (r) =>
          r.name.includes(query) ||
          r.desc.includes(query) ||
          r.dept.includes(query)
      )
    : MOCK_ROLES;

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
        onClick={() => {
          setOpen(!open);
          setQuery("");
          setTimeout(() => searchRef.current?.focus(), 50);
        }}
        className={cn(
          "focus-ring flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors duration-fast disabled:opacity-50 disabled:pointer-events-none",
          selected
            ? "border-primary/30 bg-accent-muted text-[#F5F5F4]"
            : "border-border-subtle bg-surface-overlay text-text-subtle hover:text-[#F5F5F4]"
        )}
      >
        <span>@ {selected?.name || "AI 同事"}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-50 mb-2 w-80 rounded-lg border border-border bg-surface-raised p-2 shadow-lg">
            <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-surface px-2">
              <Search size={14} className="shrink-0 text-text-muted" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索 AI 同事..."
                className="h-8 w-full bg-transparent text-sm text-[#F5F5F4] placeholder:text-text-subtle outline-none"
              />
            </div>
            <div className="max-h-[360px] overflow-y-auto product-scrollbar space-y-0.5">
              {filtered.map((role) => {
                const Icon = ICONS[role.icon] || PenLine;
                const isSelected = value === role.id;
                return (
                  <button
                    key={role.id}
                    onClick={() => {
                      onChange(isSelected ? null : role.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-fast",
                      isSelected ? "bg-accent-muted" : "hover:bg-surface-overlay"
                    )}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-muted text-primary">
                      <Icon size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#F5F5F4]">{role.name}</span>
                        <span className="text-[10px] text-text-subtle">{role.dept}</span>
                      </div>
                      <span className="text-xs text-text-muted">{role.desc}</span>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="py-4 text-center text-sm text-text-muted">没有找到相关 AI 同事</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

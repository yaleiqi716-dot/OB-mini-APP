// Part of OrangeBench product internal design system
"use client";

import { useEffect, useState, useRef } from "react";
import {
  Plug2, ChevronDown, Search, Check,
  Mail, Calendar, FolderOpen, BookOpen, Github,
  MessageSquare, Box, Figma,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ElementType> = {
  Mail, Calendar, FolderOpen, BookOpen, Github,
  MessageSquare, Box, Figma,
};

interface MCPConnector {
  id: string;
  name: string;
  icon: string;
  desc: string;
  color: string;
  status: "disconnected" | "connected" | "coming";
}

const MCP_OFFICIAL: MCPConnector[] = [
  { id: "gmail", name: "Gmail", icon: "Mail", desc: "读写邮件、发送邮件", color: "#EA4335", status: "disconnected" },
  { id: "gcal", name: "Google Calendar", icon: "Calendar", desc: "查看日程、创建事件", color: "#4285F4", status: "disconnected" },
  { id: "gdrive", name: "Google Drive", icon: "FolderOpen", desc: "读取文档、上传文件", color: "#FBBC04", status: "disconnected" },
  { id: "notion", name: "Notion", icon: "BookOpen", desc: "读写数据库、创建页面", color: "#FFFFFF", status: "disconnected" },
  { id: "github", name: "GitHub", icon: "Github", desc: "读写 issue、PR、代码", color: "#FFFFFF", status: "disconnected" },
  { id: "slack", name: "Slack", icon: "MessageSquare", desc: "收发消息、查频道", color: "#4A154B", status: "disconnected" },
  { id: "linear", name: "Linear", icon: "Box", desc: "任务管理、issue 跟踪", color: "#5E6AD2", status: "disconnected" },
  { id: "figma", name: "Figma", icon: "Figma", desc: "读取设计文件", color: "#F24E1E", status: "disconnected" },
];

const MCP_COMING: MCPConnector[] = [
  { id: "jira", name: "Jira", icon: "Box", desc: "项目管理、Sprint 追踪", color: "#0052CC", status: "coming" },
  { id: "asana", name: "Asana", icon: "Box", desc: "任务管理", color: "#F06A6A", status: "coming" },
  { id: "hubspot", name: "HubSpot", icon: "Box", desc: "CRM、联系人", color: "#FF7A59", status: "coming" },
  { id: "custom", name: "自定义 MCP Server", icon: "Plug2", desc: "接入你的私有 MCP", color: "#FF5A1F", status: "coming" },
];

const LS_CONNECTED = "orangebench.agent.mcp.connected";
const LS_SELECTED = "orangebench.agent.mcp.selected";

function loadSet(key: string): Set<string> {
  try {
    const v = localStorage.getItem(key);
    return v ? new Set(JSON.parse(v)) : new Set();
  } catch { return new Set(); }
}
function saveSet(key: string, s: Set<string>) {
  try { localStorage.setItem(key, JSON.stringify([...s])); } catch {}
}

export function MCPToolSelector({
  selectedCount,
  onSelectedCountChange,
  disabled = false,
}: {
  selectedCount: number;
  onSelectedCountChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = loadSet(LS_CONNECTED);
    const s = loadSet(LS_SELECTED);
    setConnected(c);
    setSelected(s);
    onSelectedCountChange(s.size);
  }, [onSelectedCountChange]);

  function handleConnect(id: string) {
    console.log(`[MCP] OAuth flow for ${id} (not implemented)`);
    const next = new Set(connected);
    next.add(id);
    setConnected(next);
    saveSet(LS_CONNECTED, next);
    const ns = new Set(selected);
    ns.add(id);
    setSelected(ns);
    saveSet(LS_SELECTED, ns);
    onSelectedCountChange(ns.size);
  }

  function toggleSelect(id: string) {
    const ns = new Set(selected);
    if (ns.has(id)) ns.delete(id); else ns.add(id);
    setSelected(ns);
    saveSet(LS_SELECTED, ns);
    onSelectedCountChange(ns.size);
  }

  const filtered = query
    ? MCP_OFFICIAL.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.desc.includes(query))
    : MCP_OFFICIAL;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(!open); setQuery(""); setTimeout(() => searchRef.current?.focus(), 50); }}
        className={cn(
          "focus-ring flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors duration-fast disabled:opacity-50 disabled:pointer-events-none",
          selectedCount > 0
            ? "border-primary/30 bg-accent-muted text-[#F5F5F4]"
            : "border-border-subtle bg-surface-overlay text-text-subtle hover:text-[#F5F5F4]"
        )}
      >
        <Plug2 size={14} />
        <span>{selectedCount > 0 ? `${selectedCount} 个技能` : "技能"}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-50 mb-2 w-[360px] rounded-lg border border-border bg-surface-raised shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <span className="text-sm font-medium text-[#F5F5F4]">MCP 技能</span>
              <span className="text-[10px] text-text-subtle">通过 OAuth 一键连接</span>
            </div>
            {/* Search */}
            <div className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-border bg-surface px-2">
              <Search size={14} className="shrink-0 text-text-muted" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索 MCP 连接器..."
                className="h-8 w-full bg-transparent text-sm text-[#F5F5F4] placeholder:text-text-subtle outline-none"
              />
            </div>

            <div className="max-h-[360px] overflow-y-auto product-scrollbar px-2 pb-2">
              {/* Official */}
              <div className="mb-1 px-1 pt-1 text-[10px] font-medium uppercase tracking-widest text-text-subtle">
                常用连接器
              </div>
              {filtered.map((c) => {
                const Icon = ICONS[c.icon] || Plug2;
                const isConn = connected.has(c.id);
                const isSel = selected.has(c.id);
                const isWhite = c.color === "#FFFFFF";
                return (
                  <div
                    key={c.id}
                    onClick={() => isConn && toggleSelect(c.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-fast",
                      isConn ? "cursor-pointer hover:bg-surface-overlay" : ""
                    )}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: c.color }}
                    >
                      <Icon size={14} className={isWhite ? "text-[#0C0C0A]" : "text-[#F5F5F4]"} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[#F5F5F4]">{c.name}</span>
                      <br />
                      <span className="text-xs text-text-muted">{c.desc}</span>
                    </div>
                    {!isConn && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleConnect(c.id); }}
                        className="shrink-0 rounded-md bg-primary px-2 py-1 text-xs font-medium text-[#F5F5F4] hover:bg-accent-hover transition-colors duration-fast"
                      >
                        连接
                      </button>
                    )}
                    {isConn && (
                      <span className={cn("shrink-0", isSel ? "text-primary" : "text-success")}>
                        <Check size={14} />
                      </span>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="py-4 text-center text-sm text-text-muted">没有找到匹配的 MCP 连接器</p>
              )}

              {/* Coming soon */}
              <div className="mb-1 mt-3 px-1 pt-1 text-[10px] font-medium uppercase tracking-widest text-text-subtle">
                更多连接器
              </div>
              {MCP_COMING.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-md px-2 py-2 opacity-50">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-overlay">
                    <Plug2 size={14} className="text-text-muted" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-text-muted">{c.name}</span>
                    <br />
                    <span className="text-xs text-text-subtle">{c.desc}</span>
                  </div>
                  <span className="shrink-0 text-xs text-text-subtle">敬请期待</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

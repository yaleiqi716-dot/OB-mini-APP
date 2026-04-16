// Part of OrangeBench product internal design system
"use client";

import { ListChecks, Users, FolderKanban, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const ACTIONS = [
  { icon: ListChecks, label: "我的任务", sublabel: "暂无运行中", href: "/tasks" },
  { icon: Users, label: "AI 同事", sublabel: "20 个可协作", href: "/account/skills" },
  { icon: FolderKanban, label: "工作区", sublabel: "OrangeBench", href: "/workspace" },
];

export function QuickActionCards() {
  return (
    <div className="grid w-full max-w-2xl grid-cols-3 gap-3">
      {ACTIONS.map(({ icon: Icon, label, sublabel, href }) => (
        <Link
          key={label}
          href={href}
          className="group flex items-center gap-3 rounded-lg border border-border-subtle bg-surface/80 px-4 py-3.5 backdrop-blur-md transition-all duration-base ease-smooth hover:border-border-strong hover:bg-surface-raised"
        >
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-[#F5F5F4]">{label}</div>
            <div className="truncate text-xs text-text-muted">{sublabel}</div>
          </div>
          <ArrowUpRight className="h-3 w-3 shrink-0 text-text-subtle transition-colors group-hover:text-text-muted" />
        </Link>
      ))}
    </div>
  );
}

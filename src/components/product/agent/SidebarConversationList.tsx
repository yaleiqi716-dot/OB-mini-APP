// Part of OrangeBench product internal design system
"use client";

import { useState } from "react";
import { SidebarConversationItem } from "./SidebarConversationItem";
import type { Conversation } from "./types";

const mockConversations: Conversation[] = [
  { id: "c1", title: "写一份商业计划书", updatedAt: "刚刚", group: "今天" },
  { id: "c2", title: "生成一个产品介绍 PPT", updatedAt: "2 小时前", group: "今天" },
  { id: "c3", title: "分析市场竞品情况", updatedAt: "昨天", group: "昨天" },
  { id: "c4", title: "帮我制定月度工作计划", updatedAt: "3 天前", group: "过去 7 天" },
  { id: "c5", title: "写一封客户跟进邮件", updatedAt: "4 天前", group: "过去 7 天" },
  { id: "c6", title: "做一份竞品分析报告", updatedAt: "上周", group: "更早" },
  { id: "c7", title: "帮我写一段品牌介绍", updatedAt: "2 周前", group: "更早" },
];

const GROUPS = ["今天", "昨天", "过去 7 天", "更早"];

export function SidebarConversationList({
  collapsed,
  activeId,
  onSelect,
}: {
  collapsed: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const grouped = GROUPS.map((g) => ({
    label: g,
    items: mockConversations.filter((c) => c.group === g),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex-1 overflow-y-auto px-2 py-1 product-scrollbar">
      {grouped.map((group) => (
        <div key={group.label} className="mb-2">
          {!collapsed && (
            <div className="px-2.5 py-2 text-[10px] font-medium uppercase tracking-widest text-text-subtle">
              {group.label}
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            {group.items.map((conv) => (
              <SidebarConversationItem
                key={conv.id}
                conversation={conv}
                active={conv.id === activeId}
                collapsed={collapsed}
                onClick={() => onSelect(conv.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

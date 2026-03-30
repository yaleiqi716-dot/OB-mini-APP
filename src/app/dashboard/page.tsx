'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Summary {
  tasksCompleted: number;
  tasksPending: number;
  tasksFailed: number;
  tasksBlocked: number;
  creditsConsumed: number;
  highlights: string[];
  issues: string[];
  aiSuggestions: string[];
}

export default function DashboardPage() {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    fetch('/api/summary')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="h-screen bg-surface-primary flex items-center justify-center">
        <p className="text-content-tertiary text-sm">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-primary">
      <header className="flex items-center justify-between px-6 h-12 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-accent font-semibold text-sm">ORANGE</span>
            <span className="text-content-primary font-semibold text-sm">BENCH</span>
          </div>
          <span className="text-xs text-content-tertiary">工作台</span>
        </div>
        <Link href="/agent" className="text-xs text-accent hover:text-accent-hover transition-colors">
          返回 Agent
        </Link>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="今日完成" value={data.tasksCompleted} color="text-green-400" />
          <StatCard label="进行中" value={data.tasksPending} color="text-accent" />
          <StatCard label="失败" value={data.tasksFailed} color="text-red-400" />
          <StatCard label="消耗额度" value={data.creditsConsumed} color="text-content-primary" />
        </div>

        {/* Highlights */}
        {data.highlights.length > 0 ? (
          <Section title="今日亮点" icon="✓">
            {data.highlights.map((h, i) => (
              <p key={i} className="text-sm text-content-secondary">{h}</p>
            ))}
          </Section>
        ) : null}

        {/* Issues */}
        {data.issues.length > 0 ? (
          <Section title="需要关注" icon="⚠">
            {data.issues.map((issue, i) => (
              <p key={i} className="text-sm text-amber-400">{issue}</p>
            ))}
          </Section>
        ) : null}

        {/* AI Suggestions */}
        {data.aiSuggestions.length > 0 ? (
          <Section title="AI 建议" icon="→">
            {data.aiSuggestions.map((s, i) => (
              <p key={i} className="text-sm text-content-secondary">{s}</p>
            ))}
          </Section>
        ) : null}

        {/* Blocked */}
        {data.tasksBlocked > 0 ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-400">{data.tasksBlocked} 个任务因余额不足暂停</p>
            <Link href="/agent" className="text-xs text-accent mt-2 inline-block">去充值 →</Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-surface-secondary">
      <p className="text-xs text-content-tertiary mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-accent text-sm">{icon}</span>
        <h2 className="text-sm font-medium text-content-primary">{title}</h2>
      </div>
      <div className="pl-5 space-y-1">{children}</div>
    </div>
  );
}

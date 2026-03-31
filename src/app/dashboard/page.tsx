'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Summary {
  total: number;
  assigned: number;
  submitted: number;
  completed: number;
  highlights: string[];
  risks: string[];
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
          <span className="text-xs text-content-tertiary">决策台</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/tasks" className="text-xs text-content-tertiary hover:text-accent transition-colors">
            任务
          </Link>
          <Link href="/review" className="text-xs text-accent hover:text-accent-hover transition-colors">
            审核
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="全部任务" value={data.total} color="text-content-primary" />
          <StatCard label="待处理" value={data.assigned} color="text-amber-400" />
          <StatCard label="待审核" value={data.submitted} color="text-blue-400" />
          <StatCard label="已完成" value={data.completed} color="text-green-400" />
        </div>

        {/* Highlights */}
        {data.highlights.length > 0 ? (
          <Section title="已完成" icon="✓">
            {data.highlights.map((h, i) => (
              <p key={i} className="text-sm text-content-secondary">{h}</p>
            ))}
          </Section>
        ) : null}

        {/* Risks */}
        {data.risks.length > 0 ? (
          <Section title="风险" icon="⚠">
            {data.risks.map((r, i) => (
              <p key={i} className="text-sm text-amber-400">{r}</p>
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

        {/* Quick actions */}
        {data.submitted > 0 ? (
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-blue-400">{data.submitted} 个任务等待你审核</p>
            <Link href="/review" className="text-xs text-accent mt-2 inline-block">去审核 →</Link>
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

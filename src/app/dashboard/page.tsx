'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';

interface Summary {
  total: number;
  assigned: number;
  submitted: number;
  completed: number;
  pausedAutoTasks: number;
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
      <div className="h-screen bg-surface-primary flex flex-col">
        <NavHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-content-tertiary text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-primary">
      <NavHeader />

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
          <Section title="已完成" icon="check">
            {data.highlights.map((h, i) => (
              <p key={i} className="text-sm text-content-secondary">{h}</p>
            ))}
          </Section>
        ) : null}

        {/* Risks */}
        {data.risks.length > 0 ? (
          <Section title="风险" icon="warn">
            {data.risks.map((r, i) => (
              <p key={i} className="text-sm text-amber-400">{r}</p>
            ))}
          </Section>
        ) : null}

        {/* AI Suggestions */}
        {data.aiSuggestions.length > 0 ? (
          <Section title="AI 建议" icon="spark">
            {data.aiSuggestions.map((s, i) => (
              <p key={i} className="text-sm text-content-secondary">{s}</p>
            ))}
          </Section>
        ) : null}

        {/* Quick actions */}
        {data.submitted > 0 ? (
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-blue-400">{data.submitted} 个任务等待你审核</p>
            <Link href="/review" className="text-xs text-accent mt-2 inline-block">去审核</Link>
          </div>
        ) : null}

        {data.pausedAutoTasks > 0 ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
            <p className="text-sm text-amber-400">{data.pausedAutoTasks} 个自动任务已暂停</p>
            <p className="text-xs text-content-tertiary">免费版自动任务限运行 3 次，开通 Basic 可无限运行</p>
            <Link href="/billing" className="text-xs text-accent inline-block">开通 Basic（¥39/月）</Link>
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

function SectionIcon({ name }: { name: string }) {
  const s = { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'check') return <svg {...s} stroke="#4ade80"><polyline points="20 6 9 17 4 12"/></svg>;
  if (name === 'warn')  return <svg {...s} stroke="#f59e0b"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
  if (name === 'spark') return <svg {...s} stroke="#f97316"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
  return null;
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <SectionIcon name={icon} />
        <h2 className="text-sm font-medium text-content-primary">{title}</h2>
      </div>
      <div className="pl-5 space-y-1">{children}</div>
    </div>
  );
}

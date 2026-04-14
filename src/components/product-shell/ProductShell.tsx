'use client';

import type { ReactNode } from 'react';
import { AppHeader } from '@/components/workspace/AppHeader';

export function ProductShell({
  hero,
  children,
  sidebar,
  rightRail,
  topbar,
}: {
  hero?: ReactNode;
  children: ReactNode;
  sidebar?: ReactNode;
  rightRail?: ReactNode;
  topbar?: ReactNode;
}) {
  return (
    <div className="ob-shell">
      <AppHeader />
      {topbar ? <div className="ob-page-topbar">{topbar}</div> : null}
      <div className="ob-shell-main">
        {sidebar ? <aside className="ob-primary-sidebar">{sidebar}</aside> : null}
        <main className="ob-shell-content">
          {hero ? <section className="ob-page-hero">{hero}</section> : null}
          <section className="ob-shell-body">{children}</section>
        </main>
        {rightRail ? <aside className="ob-right-rail">{rightRail}</aside> : null}
      </div>
    </div>
  );
}

export function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="ob-panel">
      <header className="ob-section-header">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function StatusPill({ children }: { children: ReactNode }) {
  return <span className="ob-status-pill ob-status-pill--token">{children}</span>;
}

export function ActionChip({ children }: { children: ReactNode }) {
  return <button className="ob-action-chip">{children}</button>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="ob-empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function SegmentControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="ob-segment">
      {options.map((option) => (
        <button
          key={option.value}
          className={option.value === value ? 'is-active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

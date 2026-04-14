'use client';

/**
 * Shared Toast component — single source of truth for transient
 * status messages across the app.
 *
 * Before this component existed, 9 pages each had their own inline
 * toast render block copy-pasted with slight drift (different colors,
 * slightly different positions, some with ok/error variants, some not).
 * Visual inconsistency was a slow bleed of "the app feels a bit off".
 *
 * This component accepts both state shapes used in the codebase:
 *   - plain string                             → neutral success toast
 *   - { msg: string; ok: boolean }             → success / error variant
 *   - null                                     → renders nothing
 *
 * Pages keep their own local toast state + setTimeout logic — only
 * the visual markup is unified here. That lets adoption happen
 * incrementally without refactoring any business logic.
 *
 * Tokens from DESIGN.md v1.2:
 *   success background = --ob-success (sand, warm confirmation)
 *   error background   = --ob-error   (warm red)
 *   position           = fixed bottom center, above everything
 */

// Accepts all three state shapes actually used in the codebase:
//   - plain string              (used by /account, /settings, /review, /workspace/*)
//   - { msg, ok }               (used by /dashboard, /tasks/[taskId])
//   - { text, ok }              (used by /billing — predates convention)
// The union lets existing pages keep their business logic unchanged.
type ToastValue =
  | string
  | { msg: string; ok: boolean }
  | { text: string; ok: boolean }
  | null
  | undefined;

interface ToastProps {
  value: ToastValue;
}

export function Toast({ value }: ToastProps) {
  if (!value) return null;
  const isString = typeof value === 'string';
  const message = isString
    ? value
    : 'msg' in value
      ? value.msg
      : value.text;
  const ok = isString ? true : value.ok;

  return (
    <div
      className="animate-flow-in"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        padding: '10px 20px',
        borderRadius: 10,
        background: ok ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
        border: ok ? '1px solid rgba(22,163,74,0.30)' : '1px solid rgba(220,38,38,0.30)',
        color: ok ? '#86EFAC' : '#FCA5A5',
        fontSize: 13,
        fontFamily: 'var(--ob-font-body)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.20)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {message}
    </div>
  );
}

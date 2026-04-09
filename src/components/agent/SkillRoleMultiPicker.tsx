'use client';

import { useEffect, useMemo, useState } from 'react';

// Multi-select variant of SkillRolePicker, designed for the
// "suggest 1-3 AI colleagues" field on /workspace/tasks/new.
//
// Shape: a scrollable grid of toggleable chips grouped by department.
// Not a dropdown — embedded inline in the form card, so the owner can
// see all choices at once while filling in task title/description/etc.
// Max 3 selections enforced client-side (cheap UX signal; server doesn't
// police this yet to keep the contract forward-compatible).

interface SkillRoleMeta {
  id: string;
  department: string;
  name: string;
  description: string;
  color?: string;
}

interface DepartmentGroup {
  key: string;
  label: string;
  roles: SkillRoleMeta[];
}

interface SkillRoleMultiPickerProps {
  value: string[]; // role ids
  onChange: (roleIds: string[]) => void;
  max?: number;
  disabled?: boolean;
}

// Module-level cache — shared with SkillRolePicker so a new-task page
// visit after using the /agent composer reuses the same in-memory data.
let cachedGroups: DepartmentGroup[] | null = null;

export function SkillRoleMultiPicker({
  value,
  onChange,
  max = 3,
  disabled,
}: SkillRoleMultiPickerProps) {
  const [groups, setGroups] = useState<DepartmentGroup[] | null>(cachedGroups);
  const [loading, setLoading] = useState(!cachedGroups);

  useEffect(() => {
    if (cachedGroups) return;
    fetch('/api/skills')
      .then(r => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { departments: DepartmentGroup[] }) => {
        cachedGroups = data.departments || [];
        setGroups(cachedGroups);
      })
      .catch(() => {
        // Silent — the picker becomes empty but the form still submits.
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedSet = useMemo(() => new Set(value), [value]);

  function toggle(id: string) {
    if (disabled) return;
    if (selectedSet.has(id)) {
      onChange(value.filter(x => x !== id));
    } else {
      if (value.length >= max) return; // max enforcement
      onChange([...value, id]);
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <label
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--ob-text)',
          }}
        >
          推荐 AI 同事 <span style={{ color: 'var(--ob-text-dim)', fontWeight: 400 }}>(可选 · 最多 {max} 个)</span>
        </label>
        <span
          style={{
            fontFamily: 'var(--ob-font-mono)',
            fontSize: 10,
            color: 'var(--ob-text-dim)',
            letterSpacing: '0.08em',
          }}
        >
          {value.length} / {max}
        </span>
      </div>
      <p
        style={{
          fontSize: 12,
          color: 'var(--ob-text-muted)',
          margin: '0 0 12px',
          lineHeight: 1.5,
        }}
      >
        选 1-3 个专业角色,员工用 Agent 执行时会优先建议这些角色。
      </p>

      {loading && (
        <div
          style={{
            padding: 16,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--ob-text-muted)',
            background: 'var(--ob-surface-hi)',
            borderRadius: 12,
            border: '1px solid var(--ob-border)',
          }}
        >
          加载中...
        </div>
      )}

      {!loading && groups && (
        <div
          style={{
            maxHeight: 280,
            overflow: 'auto',
            padding: 12,
            background: 'var(--ob-surface-hi)',
            border: '1px solid var(--ob-border)',
            borderRadius: 12,
          }}
        >
          {groups.map(group => (
            <div key={group.key} style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontFamily: 'var(--ob-font-mono)',
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--ob-text-dim)',
                  marginBottom: 6,
                }}
              >
                {group.label}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                {group.roles.map(role => {
                  const active = selectedSet.has(role.id);
                  const atMax = value.length >= max && !active;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggle(role.id)}
                      disabled={disabled || atMax}
                      title={role.description}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        height: 28,
                        padding: '0 12px',
                        borderRadius: 9999,
                        background: active
                          ? 'var(--ob-orange, #FF5A1F)'
                          : 'var(--ob-surface)',
                        color: active ? '#fff' : 'var(--ob-text)',
                        border: active
                          ? '1px solid var(--ob-orange, #FF5A1F)'
                          : '1px solid var(--ob-border)',
                        fontFamily: 'var(--ob-font-body)',
                        fontSize: 12,
                        fontWeight: active ? 600 : 500,
                        cursor: disabled || atMax ? 'not-allowed' : 'pointer',
                        opacity: atMax ? 0.4 : 1,
                        transition: 'all .12s cubic-bezier(.2,.7,.3,1)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {active && <span style={{ fontSize: 11 }}>✓</span>}
                      {role.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !groups && (
        <div
          style={{
            padding: 16,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--ob-text-muted)',
            background: 'var(--ob-surface-hi)',
            borderRadius: 12,
            border: '1px solid var(--ob-border)',
          }}
        >
          暂时加载不了 AI 同事列表
        </div>
      )}
    </div>
  );
}

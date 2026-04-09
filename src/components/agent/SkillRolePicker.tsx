'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Lightweight picker for the "AI 同事" (skill role) dropdown in the composer toolbar.
// Matches the existing model-pill visual style: 28px pill, mono font, orange dot.
//
// Props are controlled — the parent (AgentInput / agent page) owns the
// selected role id so it can reset when switching conversations.

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

interface SkillRolePickerProps {
  value: string | null;
  onChange: (roleId: string | null) => void;
  disabled?: boolean;
}

// Module-level cache so a second composer mount doesn't re-fetch.
let cachedGroups: DepartmentGroup[] | null = null;
let cachedFlat: SkillRoleMeta[] | null = null;

export function SkillRolePicker({ value, onChange, disabled }: SkillRolePickerProps) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<DepartmentGroup[] | null>(cachedGroups);
  const [flat, setFlat] = useState<SkillRoleMeta[] | null>(cachedFlat);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch role list on first open (lazy). Cached after first load.
  useEffect(() => {
    if (!open) return;
    if (groups) return;
    setLoading(true);
    fetch('/api/skills')
      .then(r => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { departments: DepartmentGroup[] }) => {
        const g = data.departments || [];
        const f = g.flatMap(x => x.roles);
        cachedGroups = g;
        cachedFlat = f;
        setGroups(g);
        setFlat(f);
      })
      .catch(() => {
        // Silent failure — picker just stays empty. No toast, no crash.
      })
      .finally(() => setLoading(false));
  }, [open, groups]);

  // Focus the search input when the dropdown opens so users can type immediately.
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  // Find the currently selected role meta (for pill label).
  const selected = useMemo(() => {
    if (!value || !flat) return null;
    return flat.find(r => r.id === value) || null;
  }, [value, flat]);

  // Filter view — either the full grouped list or a flat search result.
  const searchResults = useMemo(() => {
    if (!query.trim() || !flat) return null;
    const q = query.trim().toLowerCase();
    return flat.filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }, [query, flat]);

  const handleSelect = useCallback(
    (roleId: string | null) => {
      onChange(roleId);
      setOpen(false);
      setQuery('');
    },
    [onChange],
  );

  const pillLabel = selected ? selected.name : '选 AI 同事';

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        title={selected ? `当前: ${selected.name}` : '选一个 AI 专业同事角色'}
        aria-label={selected ? `AI 同事: ${selected.name}` : '选 AI 同事'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 28,
          padding: '0 12px',
          marginLeft: 4,
          borderRadius: 9999,
          background: selected ? 'var(--ob-orange-lo, rgba(255,90,31,0.10))' : 'var(--ob-surface-hi)',
          border: selected
            ? '1px solid var(--ob-orange, #FF5A1F)'
            : '1px solid var(--ob-border)',
          color: 'var(--ob-text)',
          fontFamily: 'var(--ob-font-mono)',
          fontSize: 11,
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          opacity: disabled ? 0.5 : 1,
          transition: 'all .12s cubic-bezier(.2,.7,.3,1)',
          maxWidth: 180,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <span style={{ fontSize: 12, lineHeight: 1 }}>@</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{pillLabel}</span>
        <span style={{ color: 'var(--ob-text-muted)', fontSize: 9, marginLeft: 2 }}>▾</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="AI 同事选择器"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 8,
            width: 380,
            maxHeight: 420,
            background: 'var(--ob-surface)',
            border: '1px solid var(--ob-border)',
            borderRadius: 12,
            boxShadow: '0 12px 36px rgba(0,0,0,0.55)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Search bar */}
          <div
            style={{
              padding: 12,
              borderBottom: '1px solid var(--ob-border)',
              background: 'var(--ob-surface)',
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜索角色... 例如:小红书 / 数据 / 招聘"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: '100%',
                height: 32,
                padding: '0 10px',
                background: 'var(--ob-surface-hi)',
                border: '1px solid var(--ob-border)',
                borderRadius: 6,
                color: 'var(--ob-text)',
                fontFamily: 'var(--ob-font-body)',
                fontSize: 13,
                outline: 'none',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--ob-orange)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'var(--ob-border)';
              }}
            />
          </div>

          {/* Selected-role clear row */}
          {selected && (
            <button
              type="button"
              onClick={() => handleSelect(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--ob-border)',
                color: 'var(--ob-text-muted)',
                fontFamily: 'var(--ob-font-body)',
                fontSize: 12,
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--ob-surface-hi)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: 14 }}>✕</span>
              <span>清除选择(回到普通 agent 模式)</span>
            </button>
          )}

          {/* Role list */}
          <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
            {loading && (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  color: 'var(--ob-text-muted)',
                  fontSize: 12,
                }}
              >
                加载中...
              </div>
            )}

            {!loading && !groups && (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  color: 'var(--ob-text-muted)',
                  fontSize: 12,
                }}
              >
                暂时加载不了 AI 同事列表
              </div>
            )}

            {/* Search results (flat) */}
            {!loading && searchResults && (
              <>
                {searchResults.length === 0 && (
                  <div
                    style={{
                      padding: 24,
                      textAlign: 'center',
                      color: 'var(--ob-text-muted)',
                      fontSize: 12,
                    }}
                  >
                    没找到匹配的角色
                  </div>
                )}
                {searchResults.map(role => (
                  <RoleRow
                    key={role.id}
                    role={role}
                    active={role.id === value}
                    onSelect={handleSelect}
                  />
                ))}
              </>
            )}

            {/* Grouped (no search) */}
            {!loading && !searchResults && groups && (
              <>
                {groups.map(group => (
                  <div key={group.key} style={{ marginBottom: 4 }}>
                    <div
                      style={{
                        padding: '8px 14px 4px',
                        fontFamily: 'var(--ob-font-mono)',
                        fontSize: 9,
                        fontWeight: 600,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'var(--ob-text-dim)',
                      }}
                    >
                      {group.label}
                    </div>
                    {group.roles.map(role => (
                      <RoleRow
                        key={role.id}
                        role={role}
                        active={role.id === value}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer hint */}
          <div
            style={{
              padding: '8px 14px',
              borderTop: '1px solid var(--ob-border)',
              fontFamily: 'var(--ob-font-mono)',
              fontSize: 9,
              letterSpacing: '0.08em',
              color: 'var(--ob-text-dim)',
              textAlign: 'center',
            }}
          >
            {flat?.length ?? 0} 个 AI 同事 · ESC 关闭
          </div>
        </div>
      )}
    </div>
  );
}

// Single row in the dropdown. Orange highlight if active.
function RoleRow({
  role,
  active,
  onSelect,
}: {
  role: SkillRoleMeta;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(role.id)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        width: '100%',
        padding: '8px 14px',
        background: active ? 'var(--ob-orange-lo, rgba(255,90,31,0.10))' : 'transparent',
        border: 'none',
        borderLeft: active ? '2px solid var(--ob-orange)' : '2px solid transparent',
        color: 'var(--ob-text)',
        fontFamily: 'var(--ob-font-body)',
        fontSize: 13,
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background .1s',
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.background = 'var(--ob-surface-hi)';
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ob-text)' }}>
        {role.name}
      </span>
      <span
        style={{
          fontSize: 11,
          color: 'var(--ob-text-muted)',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {role.description}
      </span>
    </button>
  );
}

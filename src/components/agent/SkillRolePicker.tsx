'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Two-level picker for "AI 同事" (skill role) in the composer toolbar.
//
// Level 1: Department list — 每个部门一行, 显示 emoji + 名称 + 角色数 + 箭头
// Level 2: Roles within selected department — ← 返回 + 角色列表
// Search: 跳过部门, 直接显示匹配角色 + 部门标签

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

// Department emoji icons for visual hierarchy
const DEPT_ICONS: Record<string, string> = {
  marketing: '🎯',
  design: '🎨',
  sales: '🤝',
  hr: '👥',
  product: '📋',
  'project-management': '📊',
  support: '💬',
  specialized: '⚡',
  finance: '💰',
  legal: '⚖️',
  engineering: '💻',
  'paid-media': '📢',
  'supply-chain': '📦',
  testing: '🔍',
  'game-development': '🎮',
  'spatial-computing': '🥽',
  academic: '📚',
  strategy: '🧭',
};

// Module-level cache
let cachedGroups: DepartmentGroup[] | null = null;
let cachedFlat: SkillRoleMeta[] | null = null;

export function SkillRolePicker({ value, onChange, disabled }: SkillRolePickerProps) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<DepartmentGroup[] | null>(cachedGroups);
  const [flat, setFlat] = useState<SkillRoleMeta[] | null>(cachedFlat);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'departments' | 'roles'>('departments');
  const [selectedDept, setSelectedDept] = useState<DepartmentGroup | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch on first open
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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, groups]);

  // Focus search on open
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on outside click
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

  // Close on Escape, back on Escape when in roles view
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (view === 'roles') {
          setView('departments');
          setSelectedDept(null);
        } else {
          setOpen(false);
        }
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, view]);

  // Reset view when closing
  useEffect(() => {
    if (!open) {
      setView('departments');
      setSelectedDept(null);
      setQuery('');
    }
  }, [open]);

  const selected = useMemo(() => {
    if (!value || !flat) return null;
    return flat.find(r => r.id === value) || null;
  }, [value, flat]);

  // Search results with department label
  const searchResults = useMemo(() => {
    if (!query.trim() || !flat || !groups) return null;
    const q = query.trim().toLowerCase();
    return flat
      .filter(r => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
      .map(r => {
        const dept = groups.find(g => g.key === r.department);
        return { ...r, deptLabel: dept?.label || '' };
      });
  }, [query, flat, groups]);

  // Sorted departments by role count (most first)
  const sortedGroups = useMemo(() => {
    if (!groups) return [];
    return [...groups].sort((a, b) => b.roles.length - a.roles.length);
  }, [groups]);

  const handleSelect = useCallback(
    (roleId: string | null) => {
      onChange(roleId);
      setOpen(false);
      setQuery('');
    },
    [onChange],
  );

  const handleDeptClick = useCallback((dept: DepartmentGroup) => {
    setSelectedDept(dept);
    setView('roles');
    setQuery('');
  }, []);

  const handleBack = useCallback(() => {
    setView('departments');
    setSelectedDept(null);
  }, []);

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
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 28, padding: '0 12px', marginLeft: 4,
          borderRadius: 9999,
          background: selected ? 'var(--ob-orange-lo, rgba(255,90,31,0.10))' : 'var(--ob-surface-hi)',
          border: selected ? '1px solid var(--ob-orange, #FF5A1F)' : '1px solid var(--ob-border)',
          color: 'var(--ob-text)',
          fontFamily: 'var(--ob-font-mono)', fontSize: 11, fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap', opacity: disabled ? 0.5 : 1,
          transition: 'all .12s cubic-bezier(.2,.7,.3,1)',
          maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis',
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
            position: 'absolute', bottom: '100%', left: 0, marginBottom: 8,
            width: 380, maxHeight: 460,
            background: 'var(--ob-surface)', border: '1px solid var(--ob-border)',
            borderRadius: 12, boxShadow: '0 12px 36px rgba(0,0,0,0.55)',
            zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* Header: search + back button */}
          <div style={{ padding: 12, borderBottom: '1px solid var(--ob-border)', background: 'var(--ob-surface)' }}>
            {view === 'roles' && selectedDept && (
              <button
                type="button"
                onClick={handleBack}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: 'none', color: 'var(--ob-orange, #FF5A1F)',
                  fontFamily: 'var(--ob-font-body)', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', padding: '0 0 8px',
                }}
              >
                <span style={{ fontSize: 16 }}>←</span>
                <span>{selectedDept.label}</span>
                <span style={{ color: 'var(--ob-text-dim)', fontSize: 11, fontWeight: 400 }}>
                  {selectedDept.roles.length} 个岗位
                </span>
              </button>
            )}
            <input
              ref={searchInputRef}
              type="text"
              placeholder={view === 'departments' ? '搜索部门或岗位...' : `在 ${selectedDept?.label || ''} 中搜索...`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: '100%', height: 32, padding: '0 10px',
                background: 'var(--ob-surface-hi)', border: '1px solid var(--ob-border)',
                borderRadius: 6, color: 'var(--ob-text)',
                fontFamily: 'var(--ob-font-body)', fontSize: 13, outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--ob-orange)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--ob-border)'; }}
            />
          </div>

          {/* Clear selection */}
          {selected && view === 'departments' && !query && (
            <button
              type="button"
              onClick={() => handleSelect(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '10px 14px',
                background: 'transparent', border: 'none',
                borderBottom: '1px solid var(--ob-border)',
                color: 'var(--ob-text-muted)',
                fontFamily: 'var(--ob-font-body)', fontSize: 12,
                textAlign: 'left', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--ob-surface-hi)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 14 }}>✕</span>
              <span>清除选择(回到普通 agent 模式)</span>
            </button>
          )}

          {/* Content area */}
          <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
            {loading && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--ob-text-muted)', fontSize: 12 }}>
                加载中...
              </div>
            )}

            {!loading && !groups && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--ob-text-muted)', fontSize: 12 }}>
                暂时加载不了 AI 同事列表
              </div>
            )}

            {/* Search results — flat with department labels */}
            {!loading && searchResults && (
              <>
                {searchResults.length === 0 && (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--ob-text-muted)', fontSize: 12 }}>
                    没找到匹配的角色
                  </div>
                )}
                {searchResults.map(role => (
                  <RoleRow
                    key={role.id}
                    role={role}
                    active={role.id === value}
                    onSelect={handleSelect}
                    deptLabel={role.deptLabel}
                  />
                ))}
              </>
            )}

            {/* Level 1: Department list */}
            {!loading && !searchResults && view === 'departments' && sortedGroups.length > 0 && (
              <>
                {sortedGroups.map(dept => (
                  <button
                    key={dept.key}
                    type="button"
                    onClick={() => handleDeptClick(dept)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '12px 14px',
                      background: 'transparent', border: 'none',
                      color: 'var(--ob-text)',
                      fontFamily: 'var(--ob-font-body)', fontSize: 14, fontWeight: 500,
                      textAlign: 'left', cursor: 'pointer',
                      borderRadius: 8,
                      transition: 'background .1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--ob-surface-hi)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>
                      {DEPT_ICONS[dept.key] || '📁'}
                    </span>
                    <span style={{ flex: 1 }}>{dept.label}</span>
                    <span
                      style={{
                        fontSize: 10, fontWeight: 600,
                        padding: '2px 8px', borderRadius: 9999,
                        background: 'var(--ob-surface-hi)',
                        color: 'var(--ob-text-muted)',
                        fontFamily: 'var(--ob-font-mono)',
                      }}
                    >
                      {dept.roles.length}
                    </span>
                    <span style={{ color: 'var(--ob-text-dim)', fontSize: 12 }}>›</span>
                  </button>
                ))}
              </>
            )}

            {/* Level 2: Roles within selected department */}
            {!loading && !searchResults && view === 'roles' && selectedDept && (
              <>
                {selectedDept.roles.map(role => (
                  <RoleRow
                    key={role.id}
                    role={role}
                    active={role.id === value}
                    onSelect={handleSelect}
                  />
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '8px 14px', borderTop: '1px solid var(--ob-border)',
              fontFamily: 'var(--ob-font-mono)', fontSize: 9,
              letterSpacing: '0.08em', color: 'var(--ob-text-dim)', textAlign: 'center',
            }}
          >
            {view === 'departments'
              ? `${sortedGroups.length} 个部门 · ${flat?.length ?? 0} 个岗位 · ESC 关闭`
              : `${selectedDept?.roles.length ?? 0} 个岗位 · ESC 返回`}
          </div>
        </div>
      )}
    </div>
  );
}

function RoleRow({
  role,
  active,
  onSelect,
  deptLabel,
}: {
  role: SkillRoleMeta;
  active: boolean;
  onSelect: (id: string) => void;
  deptLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(role.id)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
        width: '100%', padding: '10px 14px',
        background: active ? 'var(--ob-orange-lo, rgba(255,90,31,0.10))' : 'transparent',
        border: 'none',
        borderLeft: active ? '2px solid var(--ob-orange)' : '2px solid transparent',
        color: 'var(--ob-text)',
        fontFamily: 'var(--ob-font-body)', fontSize: 13,
        textAlign: 'left', cursor: 'pointer',
        borderRadius: 6,
        transition: 'background .1s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--ob-surface-hi)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{role.name}</span>
        {deptLabel && (
          <span style={{
            fontSize: 9, fontFamily: 'var(--ob-font-mono)',
            color: 'var(--ob-text-dim)', letterSpacing: '0.05em',
          }}>
            {deptLabel}
          </span>
        )}
      </div>
      <span style={{
        fontSize: 11, color: 'var(--ob-text-muted)', lineHeight: 1.4,
        overflow: 'hidden', textOverflow: 'ellipsis',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {role.description}
      </span>
    </button>
  );
}

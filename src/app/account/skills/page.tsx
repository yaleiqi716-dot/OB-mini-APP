'use client';

// /account/skills — Skills Hub (v3: superpower.com inspired)
//
// Design reference: superpower.com
// - Dark hero section with large display type
// - White content sections with generous spacing (80-120px)
// - Dark/light alternating sections for rhythm
// - Cards with orange accent shadow on hover
// - Badges with orange tint background
// - Scroll-triggered entrance animations

import { useEffect, useState, useCallback, useRef } from 'react';
import { AppHeader, AccountSubNav } from '@/components/workspace/AppHeader';
import { Toast } from '@/components/ui/Toast';
import SkillIcon from '@/components/skills/SkillIcon';
import {
  SKILL_CATALOG,
  CONNECTION_METHOD_LABELS,
  type SkillCatalogEntry,
} from '@/services/skills/catalog';

// ── Types ────────────────────────────────────────────────────────────

interface ConnectedSkill {
  instanceId: string;
  skillId: string;
  name: string;
  type: 'webhook' | 'browse' | 'mcp';
  status: 'active' | 'disabled';
  icon: string;
  connectionMethod: string;
  toolCount?: number;
  lastUsedAt?: string | null;
}

interface Quota {
  browse: { used: number; limit: number };
  mcp: { used: number; limit: number };
}

// ── Scroll-triggered animation hook ──────────────────────────────────

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function RevealSection({ children, className = '', style = {} }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.6s cubic-bezier(0.25,0.1,0.25,1), transform 0.6s cubic-bezier(0.25,0.1,0.25,1)',
      }}
    >
      {children}
    </div>
  );
}

// ── Section definitions ──────────────────────────────────────────────

const SECTIONS: {
  id: string;
  title: string;
  subtitle: string;
  filter: (e: SkillCatalogEntry) => boolean;
  dark?: boolean;
}[] = [
  {
    id: 'recommended',
    title: '推荐',
    subtitle: '零配置,一键启用,立即让 Agent 变强',
    filter: e => e.preInstalled === true || e.connectionMethod === 'builtin',
  },
  {
    id: 'notification',
    title: '通知推送',
    subtitle: '任务完成、提交、分配时自动推送到团队工具',
    filter: e => e.category === 'notification',
    dark: true,
  },
  {
    id: 'data',
    title: '数据抓取',
    subtitle: '登录你的平台账号,Agent 帮你拉数据、截图、出报告',
    filter: e => e.category === 'data',
  },
  {
    id: 'ai-tool',
    title: 'AI 工具',
    subtitle: '让 Agent 直接操作你的文档、数据库、云服务',
    filter: e => e.category === 'ai-tool' && e.connectionMethod !== 'builtin',
    dark: true,
  },
  {
    id: 'automation',
    title: '自动化',
    subtitle: '连接 5000+ 应用,让 OB 成为你工作流的中枢',
    filter: e => e.category === 'automation',
  },
  {
    id: 'dev',
    title: '开发者',
    subtitle: '面向技术用户的高级工具和自定义入口',
    filter: e => e.category === 'dev' && !e.preInstalled,
    dark: true,
  },
];

// ── Main page ────────────────────────────────────────────────────────

export default function SkillsHubPage() {
  const [connected, setConnected] = useState<ConnectedSkill[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/skills/hub');
      if (res.ok) {
        const data = await res.json();
        setConnected(data.connected || []);
        setQuota(data.quota || null);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Install handlers
  async function handleInstall(entry: SkillCatalogEntry) {
    for (const f of entry.fields) {
      if (f.required && !formValues[f.name]?.trim()) {
        showToast(`请填写 ${f.label}`, false); return;
      }
    }
    setSubmitting(true);
    try {
      let res: Response;
      if (entry.type === 'webhook') {
        res = await fetch('/api/webhooks', { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: entry.webhookKind || 'generic', name: formValues.name || entry.name, url: formValues.url, events: entry.webhookEvents || ['task_completed'] }) });
      } else if (entry.type === 'browse') {
        res = await fetch('/api/browse/credentials', { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ siteId: entry.browseSiteId, label: formValues.label || entry.name, cookies: formValues.cookies }) });
      } else {
        res = await fetch('/api/mcp/install', { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: entry.id.replace(/-mcp$/, ''), name: formValues.name || entry.name, config: formValues }) });
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(body.error || '操作失败', false); return; }
      showToast(`${entry.name} 已连接`, true);
      setInstallingId(null); setFormValues({}); await refresh();
    } catch { showToast('网络错误', false); }
    finally { setSubmitting(false); }
  }

  async function handleDisconnect(skill: ConnectedSkill) {
    if (!confirm(`确定断开 ${skill.name}?`)) return;
    try {
      const url = skill.type === 'webhook' ? `/api/webhooks/${skill.instanceId}`
        : skill.type === 'browse' ? `/api/browse/credentials/${skill.instanceId}`
        : `/api/mcp/${skill.instanceId}`;
      await fetch(url, { method: 'DELETE' });
      showToast('已断开', true); await refresh();
    } catch { showToast('网络错误', false); }
  }

  const connectedIds = new Set(connected.map(c => c.skillId));
  const sq = searchQuery.trim().toLowerCase();
  const matchesSearch = (e: SkillCatalogEntry) =>
    !sq || e.name.toLowerCase().includes(sq) || e.description.toLowerCase().includes(sq) ||
    e.tags.some(t => t.toLowerCase().includes(sq));

  return (
    <div style={{ background: '#FAFAF8', color: '#1A1A1A', minHeight: '100vh' }}>
      <AppHeader />
      <AccountSubNav />

      {/* ═══ HERO — dark section, superpower style ═══ */}
      <div
        className="animate-hero-reveal"
        style={{
          background: '#0A0A0A',
          color: '#fff',
          padding: '80px 24px 72px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background decorative text */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%) scale(1.1)',
          fontFamily: 'var(--ob-font-display)', fontWeight: 900,
          fontSize: 'clamp(120px, 18vw, 300px)', lineHeight: 0.85,
          letterSpacing: '-0.04em', color: 'rgba(255,255,255,0.03)',
          whiteSpace: 'nowrap', userSelect: 'none', pointerEvents: 'none',
        }}>
          SKILLS
        </div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
          <div style={{
            display: 'inline-block', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            color: '#FF5A1F', marginBottom: 20,
            background: 'rgba(255,90,31,0.1)', padding: '6px 16px',
            borderRadius: 9999, border: '1px solid rgba(255,90,31,0.25)',
          }}>
            SKILLS HUB
          </div>
          <h1 style={{
            fontFamily: 'var(--ob-font-display)', fontWeight: 800,
            fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.1,
            letterSpacing: '-0.03em', margin: '16px 0',
          }}>
            扩展 Agent 的能力
          </h1>
          <p style={{
            fontSize: 17, lineHeight: 1.7, opacity: 0.6,
            maxWidth: 520, margin: '0 auto 32px',
          }}>
            连接你的工作工具,让 AI 助手真正帮你干活。<br />
            推送通知、抓取数据、操作文档,一个入口搞定。
          </p>

          {/* Search in hero */}
          <div style={{ maxWidth: 440, margin: '0 auto' }}>
            <input
              type="text"
              placeholder="搜索技能... 飞书、Notion、文件系统"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', height: 48, padding: '0 20px',
                borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)', color: '#fff',
                fontSize: 15, outline: 'none',
                backdropFilter: 'blur(8px)',
              }}
            />
          </div>
        </div>

        {/* Quota pills */}
        {quota && (
          <div style={{
            display: 'flex', gap: 12, justifyContent: 'center',
            marginTop: 32, position: 'relative', zIndex: 1,
          }}>
            <QuotaPill label="浏览" used={quota.browse.used} limit={quota.browse.limit} />
            <QuotaPill label="MCP" used={quota.mcp.used} limit={quota.mcp.limit} />
          </div>
        )}
      </div>

      {/* ═══ CONNECTED — white section ═══ */}
      {connected.length > 0 && (
        <RevealSection style={{ padding: '64px 24px', background: '#fff' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <SectionHeader title={`已连接 · ${connected.length}`} subtitle="当前 Agent 可以使用的技能" />
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 16, marginTop: 32,
            }}>
              {connected.map(skill => (
                <div
                  key={skill.instanceId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '16px 20px', borderRadius: 12,
                    background: '#FAFAF8', border: '1px solid #E5E5E0',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                  className="card-hover"
                  onClick={() => handleDisconnect(skill)}
                >
                  <SkillIcon skillId={skill.icon} size={36} connected={skill.status === 'active'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{skill.name}</div>
                    <div style={{ fontSize: 11, color: '#9A9A9A' }}>
                      {skill.toolCount ? `${skill.toolCount} 个工具` : skill.type}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </RevealSection>
      )}

      {loading && (
        <div style={{ padding: 64, textAlign: 'center', color: '#9A9A9A' }}>加载中...</div>
      )}

      {/* ═══ CATALOG SECTIONS — alternating dark/light ═══ */}
      {!loading && SECTIONS.map(section => {
        const entries = SKILL_CATALOG.filter(section.filter).filter(matchesSearch);
        if (entries.length === 0) return null;
        const isDark = section.dark;

        return (
          <RevealSection
            key={section.id}
            style={{
              padding: '80px 24px',
              background: isDark ? '#0A0A0A' : '#FFFFFF',
              color: isDark ? '#fff' : '#1A1A1A',
            }}
          >
            <div style={{ maxWidth: 1080, margin: '0 auto' }}>
              <SectionHeader
                title={section.title}
                subtitle={section.subtitle}
                dark={isDark}
              />

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 20,
                marginTop: 40,
              }}>
                {entries.map(entry => (
                  <SkillCard
                    key={entry.id}
                    entry={entry}
                    isConnected={connectedIds.has(entry.id)}
                    isInstalling={installingId === entry.id}
                    dark={isDark}
                    formValues={formValues}
                    submitting={submitting}
                    onStartInstall={() => {
                      if (entry.connectionMethod === 'oauth' && !entry.fields.length) {
                        showToast('OAuth 连接即将上线', false); return;
                      }
                      setInstallingId(entry.id);
                      setFormValues({});
                      if (entry.fields.length === 0) {
                        setTimeout(() => document.getElementById(`install-btn-${entry.id}`)?.click(), 50);
                      }
                    }}
                    onInstall={() => handleInstall(entry)}
                    onCancel={() => { setInstallingId(null); setFormValues({}); }}
                    onFieldChange={(k, v) => setFormValues(p => ({ ...p, [k]: v }))}
                  />
                ))}
              </div>
            </div>
          </RevealSection>
        );
      })}

      {/* Footer */}
      <div style={{
        background: '#0A0A0A', color: 'rgba(255,255,255,0.4)',
        padding: '40px 24px', textAlign: 'center', fontSize: 12,
      }}>
        凭证 AES-256-GCM 加密 · 浏览仅限 10 个白名单平台 · 自定义 MCP 安全自担
      </div>

      <Toast value={toast} />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function SectionHeader({ title, subtitle, dark }: { title: string; subtitle: string; dark?: boolean }) {
  return (
    <div>
      <h2 style={{
        fontFamily: 'var(--ob-font-display)', fontWeight: 700,
        fontSize: 'clamp(24px, 3vw, 36px)', letterSpacing: '-0.02em',
        lineHeight: 1.2, marginBottom: 8,
      }}>
        {title}
      </h2>
      <p style={{
        fontSize: 15, lineHeight: 1.6,
        color: dark ? 'rgba(255,255,255,0.5)' : '#6B6B6B',
        maxWidth: 480,
      }}>
        {subtitle}
      </p>
    </div>
  );
}

function QuotaPill({ label, used, limit }: { label: string; used: number; limit: number }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '8px 18px', borderRadius: 9999,
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.12)',
      fontSize: 13,
    }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <span style={{ fontWeight: 700, fontFamily: 'var(--ob-font-mono)' }}>
        {used}<span style={{ opacity: 0.3 }}>/{limit}</span>
      </span>
    </div>
  );
}

function SkillCard({
  entry, isConnected, isInstalling, dark,
  formValues, submitting,
  onStartInstall, onInstall, onCancel, onFieldChange,
}: {
  entry: SkillCatalogEntry;
  isConnected: boolean;
  isInstalling: boolean;
  dark?: boolean;
  formValues: Record<string, string>;
  submitting: boolean;
  onStartInstall: () => void;
  onInstall: () => void;
  onCancel: () => void;
  onFieldChange: (k: string, v: string) => void;
}) {
  const method = CONNECTION_METHOD_LABELS[entry.connectionMethod];
  const isOAuthFuture = entry.connectionMethod === 'oauth' && !entry.fields.length;
  const cardBg = dark ? 'rgba(255,255,255,0.05)' : '#FAFAF8';
  const cardBorder = dark ? 'rgba(255,255,255,0.08)' : '#E5E5E0';
  const cardHoverBorder = isInstalling ? '#FF5A1F' : cardBorder;

  return (
    <div
      style={{
        borderRadius: 16, padding: 24,
        background: cardBg,
        border: `1px solid ${cardHoverBorder}`,
        transition: 'all 0.25s cubic-bezier(0.25,0.1,0.25,1)',
        display: 'flex', flexDirection: 'column',
      }}
      className="card-hover"
      onMouseEnter={e => {
        if (!isInstalling) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px -8px rgba(255,90,31,0.12)';
          (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,90,31,0.3)';
        }
      }}
      onMouseLeave={e => {
        if (!isInstalling) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
          (e.currentTarget as HTMLDivElement).style.borderColor = cardBorder;
        }
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
        <SkillIcon skillId={entry.icon} size={44} connected={isConnected} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{entry.name}</span>
            {/* Connection method badge — superpower style orange tint */}
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
              padding: '3px 10px', borderRadius: 9999,
              background: `${method.color}15`,
              color: method.color,
              border: `1px solid ${method.color}30`,
              whiteSpace: 'nowrap',
            }}>
              {method.label}
            </span>
          </div>
          <p style={{
            fontSize: 13, lineHeight: 1.6, marginTop: 6,
            color: dark ? 'rgba(255,255,255,0.55)' : '#6B6B6B',
          }}>
            {entry.description}
          </p>
        </div>
      </div>

      {/* CTA */}
      {!isInstalling && (
        <button
          onClick={onStartInstall}
          disabled={isOAuthFuture}
          className="btn-press"
          style={{
            width: '100%', height: 44, borderRadius: 10,
            border: 'none', fontSize: 14, fontWeight: 600,
            cursor: isOAuthFuture ? 'not-allowed' : 'pointer',
            marginTop: 'auto',
            background: isOAuthFuture ? (dark ? 'rgba(255,255,255,0.06)' : '#E5E5E0')
              : isConnected ? (dark ? 'rgba(255,255,255,0.08)' : '#F3F3F0')
              : '#FF5A1F',
            color: isOAuthFuture ? '#9A9A9A'
              : isConnected ? (dark ? 'rgba(255,255,255,0.7)' : '#1A1A1A')
              : '#fff',
            transition: 'all 0.15s ease',
          }}
        >
          {isOAuthFuture ? '即将上线' : isConnected ? '+ 再添一个' : entry.preInstalled ? '一键启用' : '连接'}
        </button>
      )}

      {/* Install form */}
      {isInstalling && entry.fields.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${cardBorder}` }}>
          {entry.fields.map(field => (
            <div key={field.name} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.5)' : '#6B6B6B', display: 'block', marginBottom: 4 }}>
                {field.label}{field.required && <span style={{ color: '#FF5A1F' }}> *</span>}
              </label>
              {field.type === 'password' ? (
                <textarea
                  value={formValues[field.name] || ''}
                  onChange={e => onFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: `1px solid ${cardBorder}`, background: dark ? 'rgba(0,0,0,0.3)' : '#fff',
                    color: dark ? '#fff' : '#1A1A1A', fontSize: 12,
                    fontFamily: 'var(--ob-font-mono)', outline: 'none', resize: 'vertical',
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={formValues[field.name] || ''}
                  onChange={e => onFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  style={{
                    width: '100%', height: 40, padding: '0 12px', borderRadius: 8,
                    border: `1px solid ${cardBorder}`, background: dark ? 'rgba(0,0,0,0.3)' : '#fff',
                    color: dark ? '#fff' : '#1A1A1A', fontSize: 13, outline: 'none',
                  }}
                />
              )}
            </div>
          ))}
          {entry.confirmWarning && (
            <div style={{
              fontSize: 11, padding: '10px 12px', borderRadius: 8, marginBottom: 12,
              background: 'rgba(255,90,31,0.08)', color: '#FF5A1F',
              border: '1px solid rgba(255,90,31,0.2)',
            }}>
              ⚠️ {entry.confirmWarning}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              id={`install-btn-${entry.id}`}
              onClick={onInstall}
              disabled={submitting}
              className="btn-press"
              style={{
                flex: 1, height: 40, borderRadius: 8, border: 'none',
                background: '#FF5A1F', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? '连接中...' : '确认连接'}
            </button>
            <button
              onClick={onCancel}
              style={{
                height: 40, padding: '0 20px', borderRadius: 8,
                border: `1px solid ${cardBorder}`, background: 'transparent',
                color: dark ? 'rgba(255,255,255,0.7)' : '#6B6B6B',
                fontSize: 13, cursor: 'pointer',
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}
      {isInstalling && entry.fields.length === 0 && (
        <button id={`install-btn-${entry.id}`} onClick={onInstall} style={{ display: 'none' }} />
      )}
    </div>
  );
}

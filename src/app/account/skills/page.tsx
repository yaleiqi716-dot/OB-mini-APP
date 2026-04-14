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
    <div style={{ background: 'var(--ob-bg)', color: 'var(--ob-text)', minHeight: '100vh' }}>
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
        {/* Background decorative removed for clean Monday-style */}

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
            fontSize: 32, lineHeight: 1.1,
            letterSpacing: '-0.03em', margin: '16px 0',
          }}>
            扩展 Agent 的能力
          </h1>
          <p style={{
            fontSize: 15, lineHeight: 1.7, color: 'rgba(245,245,240,0.45)',
            maxWidth: 520, margin: '0 auto 32px',
          }}>
            连接你的工具，让 AI 真正帮你干活
          </p>

          {/* Search with gradient border — Monday Vibe style */}
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <div style={{
              position: 'relative', borderRadius: 16, padding: '1.5px',
              background: 'linear-gradient(135deg, #FF5A1F 0%, rgba(255,90,31,0.4) 50%, rgba(255,255,255,0.08) 100%)',
            }}>
              <input
                type="text"
                placeholder="搜索技能... 飞书、Notion、文件系统"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', height: 48, padding: '0 20px',
                  borderRadius: 14, border: 'none',
                  background: '#1A1A18', color: 'rgba(245,245,240,0.80)',
                  fontSize: 14, outline: 'none',
                }}
              />
            </div>
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
        <RevealSection style={{ padding: '64px 24px', background: 'var(--ob-bg)' }}>
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
                    background: '#1A1A18', border: '1px solid rgba(255,255,255,0.07)',
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

      {/* ═══ CATALOG SECTIONS — unified dark with Monday card grid ═══ */}
      {!loading && SECTIONS.map(section => {
        const entries = SKILL_CATALOG.filter(section.filter).filter(matchesSearch);
        if (entries.length === 0) return null;

        return (
          <RevealSection
            key={section.id}
            style={{
              padding: '48px 24px',
              background: 'var(--ob-bg)',
              color: 'var(--ob-text)',
            }}
          >
            <div style={{ maxWidth: 1080, margin: '0 auto' }}>
              <SectionHeader
                title={section.title}
                subtitle={section.subtitle}
                dark
              />

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 16,
                marginTop: 28,
              }}>
                {entries.map(entry => (
                  <SkillCard
                    key={entry.id}
                    entry={entry}
                    isConnected={connectedIds.has(entry.id)}
                    isInstalling={installingId === entry.id}
                    dark
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

function SectionHeader({ title, subtitle }: { title: string; subtitle: string; dark?: boolean }) {
  return (
    <div>
      <h2 style={{
        fontFamily: 'var(--ob-font-display)', fontWeight: 700,
        fontSize: 20, letterSpacing: '-0.02em',
        lineHeight: 1.2, marginBottom: 6,
      }}>
        {title}
      </h2>
      <p style={{
        fontSize: 13, lineHeight: 1.6,
        color: 'rgba(245,245,240,0.40)',
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
  const cardBorder = isInstalling ? '#FF5A1F' : 'rgba(255,255,255,0.08)';

  return (
    <div
      style={{
        borderRadius: 14, padding: 20,
        background: '#1A1A18',
        border: `1px solid ${cardBorder}`,
        transition: 'all 0.18s cubic-bezier(0.2,0.7,0.3,1)',
        display: 'flex', flexDirection: 'column',
      }}
      className="card-hover"
      onMouseEnter={e => {
        if (!isInstalling) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.35)';
          (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,90,31,0.28)';
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={e => {
        if (!isInstalling) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
          (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)';
          (e.currentTarget as HTMLDivElement).style.transform = 'none';
        }
      }}
    >
      {/* Header — Monday card style */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,90,31,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <SkillIcon skillId={entry.icon} size={20} connected={isConnected} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{entry.name}</span>
          <div style={{ fontSize: 11, color: 'rgba(245,245,240,0.35)' }}>{method.label}</div>
        </div>
      </div>
      {/* Description */}
      <p style={{
        fontSize: 12, lineHeight: 1.6, marginBottom: 14,
        color: 'rgba(245,245,240,0.45)',
        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {entry.description}
      </p>

      {/* CTA — Monday card bottom with connected badge */}
      {!isInstalling && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <span style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 9999,
            border: isConnected ? '1px solid rgba(52,211,153,0.30)' : '1px solid rgba(255,255,255,0.10)',
            color: isConnected ? '#34D399' : 'rgba(245,245,240,0.40)',
            background: isConnected ? 'rgba(52,211,153,0.08)' : 'transparent',
          }}>
            {isConnected ? 'Connected' : 'Not connected'}
          </span>
          <button
            onClick={onStartInstall}
            disabled={isOAuthFuture}
            className="btn-press"
            style={{
              height: 30, padding: '0 14px', borderRadius: 9999, fontSize: 12, fontWeight: 500,
              cursor: isOAuthFuture ? 'not-allowed' : 'pointer',
              border: isOAuthFuture ? '1px solid rgba(255,255,255,0.08)' : isConnected ? '1px solid rgba(255,255,255,0.12)' : 'none',
              background: isOAuthFuture ? 'transparent' : isConnected ? 'transparent' : '#FF5A1F',
              color: isOAuthFuture ? 'rgba(245,245,240,0.30)' : isConnected ? 'rgba(245,245,240,0.60)' : '#fff',
              transition: 'all 0.15s ease',
            }}
          >
            {isOAuthFuture ? '即将上线' : isConnected ? '+ 再添一个' : entry.preInstalled ? '启用' : '连接'}
          </button>
        </div>
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

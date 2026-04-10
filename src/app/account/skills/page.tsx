'use client';

// /account/skills — Skills Hub (v2: section-based layout)
//
// Replaces tab-based flat grid with structured sections:
// 推荐 → 通知推送 → 数据抓取 → AI 工具 → 开发者·高级
// Each section has a prominent header + subtitle + search filtering.

import { useEffect, useState, useCallback } from 'react';
import { AppHeader, AccountSubNav } from '@/components/workspace/AppHeader';
import { Toast } from '@/components/ui/Toast';
import SkillIcon from '@/components/skills/SkillIcon';
import {
  SKILL_CATALOG,
  CONNECTION_METHOD_LABELS,
  type SkillCatalogEntry,
  type SkillCategory,
} from '@/services/skills/catalog';

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
  failureCount?: number;
}

interface Quota {
  browse: { used: number; limit: number };
  mcp: { used: number; limit: number };
}

// Section definitions with display order, titles, subtitles
const SECTIONS: {
  id: string;
  title: string;
  subtitle: string;
  filter: (e: SkillCatalogEntry) => boolean;
  featured?: boolean;
}[] = [
  {
    id: 'recommended',
    title: '推荐',
    subtitle: '零配置,一键启用,立即可用',
    filter: e => e.preInstalled === true || e.connectionMethod === 'builtin',
    featured: true,
  },
  {
    id: 'notification',
    title: '通知推送',
    subtitle: '任务状态变更时自动发消息到团队工具',
    filter: e => e.category === 'notification',
  },
  {
    id: 'data',
    title: '数据抓取',
    subtitle: '用浏览器登录白名单平台,帮你拉数据、截图',
    filter: e => e.category === 'data',
  },
  {
    id: 'ai-tool',
    title: 'AI 工具',
    subtitle: '让 Agent 直接操作你的文件、数据库、云服务',
    filter: e => e.category === 'ai-tool' && e.connectionMethod !== 'builtin',
  },
  {
    id: 'automation',
    title: '自动化',
    subtitle: '连接 Zapier 等平台,把 OB 事件接入你的工作流',
    filter: e => e.category === 'automation',
  },
  {
    id: 'dev',
    title: '开发者 · 高级',
    subtitle: '面向技术用户的工具和自定义入口',
    filter: e => e.category === 'dev' && !e.preInstalled,
  },
];

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

  // Install handlers (same logic as before, dispatches by type)
  async function handleInstall(entry: SkillCatalogEntry) {
    for (const f of entry.fields) {
      if (f.required && !formValues[f.name]?.trim()) {
        showToast(`请填写 ${f.label}`, false);
        return;
      }
    }
    setSubmitting(true);
    try {
      let res: Response;
      if (entry.type === 'webhook') {
        res = await fetch('/api/webhooks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: entry.webhookKind || 'generic',
            name: formValues.name || entry.name,
            url: formValues.url,
            events: entry.webhookEvents || ['task_completed'],
          }),
        });
      } else if (entry.type === 'browse') {
        res = await fetch('/api/browse/credentials', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            siteId: entry.browseSiteId,
            label: formValues.label || entry.name,
            cookies: formValues.cookies,
          }),
        });
      } else {
        res = await fetch('/api/mcp/install', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: entry.id.replace(/-mcp$/, ''),
            name: formValues.name || entry.name,
            config: formValues,
          }),
        });
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(body.error || '操作失败', false); return; }
      showToast(`${entry.name} 已连接`, true);
      setInstallingId(null);
      setFormValues({});
      await refresh();
    } catch { showToast('网络错误', false); }
    finally { setSubmitting(false); }
  }

  async function handleDisconnect(skill: ConnectedSkill) {
    if (!confirm(`确定断开 ${skill.name}?`)) return;
    try {
      let url = '';
      if (skill.type === 'webhook') url = `/api/webhooks/${skill.instanceId}`;
      else if (skill.type === 'browse') url = `/api/browse/credentials/${skill.instanceId}`;
      else url = `/api/mcp/${skill.instanceId}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) { showToast('操作失败', false); return; }
      showToast('已断开', true);
      await refresh();
    } catch { showToast('网络错误', false); }
  }

  async function handleToggle(skill: ConnectedSkill, enabled: boolean) {
    try {
      let url = '';
      if (skill.type === 'webhook') url = `/api/webhooks/${skill.instanceId}`;
      else if (skill.type === 'mcp') url = `/api/mcp/${skill.instanceId}`;
      else return;
      await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ active: enabled, enabled }) });
      await refresh();
    } catch { showToast('操作失败', false); }
  }

  const connectedIds = new Set(connected.map(c => c.skillId));

  // Search filter
  const sq = searchQuery.trim().toLowerCase();
  const matchesSearch = (e: SkillCatalogEntry) =>
    !sq || e.name.toLowerCase().includes(sq) || e.description.toLowerCase().includes(sq) ||
    e.tags.some(t => t.toLowerCase().includes(sq));

  return (
    <div className="min-h-screen" style={{ background: '#0B0B0C', color: '#F5F5F0' }}>
      <AppHeader />
      <AccountSubNav />

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero */}
        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest opacity-60 mb-3">SKILLS HUB</div>
          <h1 className="text-4xl font-black tracking-tight mb-3" style={{ fontFamily: '"Cabinet Grotesk", system-ui, sans-serif' }}>
            技能中心
          </h1>
          <p className="text-sm leading-relaxed max-w-2xl opacity-75">
            扩展 Agent 的能力 — 连接外部服务推送通知、操作白名单网站抓数据、安装 MCP 工具让 Agent 直接调用。
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="搜索技能... 例如:飞书 / 文件系统 / Notion"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-4 py-2.5 text-sm rounded-xl outline-none"
            style={{ background: '#17171A', border: '1px solid #2A2A2E', color: '#F5F5F0' }}
          />
        </div>

        {/* Quota */}
        {quota && (
          <div className="mb-8 flex gap-4">
            <QuotaCard label="浏览" used={quota.browse.used} limit={quota.browse.limit} />
            <QuotaCard label="MCP 工具" used={quota.mcp.used} limit={quota.mcp.limit} />
          </div>
        )}

        {/* Connected */}
        {connected.length > 0 && (
          <div className="mb-10">
            <h2 className="text-base font-bold mb-3">已连接 ({connected.length})</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 stagger-children">
              {connected.map(skill => (
                <div
                  key={skill.instanceId}
                  className="rounded-lg p-3 flex items-center gap-2.5 animate-fade-blur card-hover"
                  style={{ background: '#17171A', border: `1px solid ${skill.status === 'active' ? '#FF5A1F22' : '#2A2A2E'}`, opacity: skill.status === 'active' ? 1 : 0.5 }}
                >
                  <SkillIcon skillId={skill.icon} size={32} connected={skill.status === 'active'} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{skill.name}</div>
                    <div className="text-[9px] opacity-40">
                      {skill.toolCount ? `${skill.toolCount} 工具` : skill.type}
                    </div>
                  </div>
                  <button
                    onClick={() => skill.type !== 'browse'
                      ? handleToggle(skill, skill.status !== 'active')
                      : handleDisconnect(skill)
                    }
                    className="text-[9px] opacity-40 hover:opacity-80"
                  >
                    {skill.status === 'active' ? '·' : '◦'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && <div className="opacity-60 text-sm">加载中...</div>}

        {/* Catalog sections */}
        {!loading && SECTIONS.map(section => {
          const entries = SKILL_CATALOG.filter(section.filter).filter(matchesSearch);
          if (entries.length === 0) return null;
          return (
            <div key={section.id} className="mb-10">
              {/* Section header */}
              <div className="mb-4 pb-3" style={{ borderBottom: '1px solid #1F1F23' }}>
                <h3 className="text-base font-bold mb-1">{section.title}</h3>
                <p className="text-xs opacity-50">{section.subtitle}</p>
              </div>

              {/* Cards grid */}
              <div className={`grid gap-3 stagger-children ${section.featured ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
                {entries.map(entry => {
                  const isInstalling = installingId === entry.id;
                  const isConnected = connectedIds.has(entry.id);
                  const method = CONNECTION_METHOD_LABELS[entry.connectionMethod];
                  const isOAuthFuture = entry.connectionMethod === 'oauth' && !entry.fields.length;

                  return (
                    <div
                      key={entry.id}
                      className="rounded-xl animate-fade-blur card-hover-glow"
                      style={{
                        background: '#17171A',
                        border: `1px solid ${isInstalling ? '#FF5A1F' : '#2A2A2E'}`,
                        padding: section.featured ? 16 : 12,
                      }}
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <SkillIcon skillId={entry.icon} size={section.featured ? 40 : 32} connected={isConnected} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-bold ${section.featured ? 'text-sm' : 'text-xs'}`}>{entry.name}</span>
                            <span
                              className="text-[8px] px-1 py-px rounded-full whitespace-nowrap"
                              style={{ background: `${method.color}15`, color: method.color, border: `1px solid ${method.color}30` }}
                            >
                              {method.label}
                            </span>
                          </div>
                          <div className={`opacity-50 mt-0.5 line-clamp-2 ${section.featured ? 'text-[11px]' : 'text-[10px]'}`}>
                            {entry.description}
                          </div>
                        </div>
                      </div>

                      {!isInstalling && (
                        <button
                          onClick={() => {
                            if (isOAuthFuture) { showToast('OAuth 连接即将上线', false); return; }
                            setInstallingId(entry.id);
                            setFormValues({});
                            if (entry.fields.length === 0) {
                              // Zero-config: auto-submit after a tick
                              setTimeout(() => document.getElementById(`install-btn-${entry.id}`)?.click(), 50);
                            }
                          }}
                          disabled={isOAuthFuture}
                          className={`w-full py-1.5 rounded-lg font-medium mt-1 btn-press ${section.featured ? 'text-xs' : 'text-[10px]'}`}
                          style={{
                            background: isOAuthFuture ? '#2A2A2E'
                              : section.featured && !isConnected ? '#FF5A1F' : '#2A2A2E',
                            color: isOAuthFuture ? '#5A5A60'
                              : section.featured && !isConnected ? '#0B0B0C' : '#F5F5F0',
                            cursor: isOAuthFuture ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isOAuthFuture ? '即将上线' : isConnected ? '+ 再添一个' : entry.preInstalled ? '一键启用' : '连接'}
                        </button>
                      )}

                      {/* Inline install form */}
                      {isInstalling && entry.fields.length > 0 && (
                        <div className="mt-2 pt-2 space-y-2" style={{ borderTop: '1px solid #2A2A2E' }}>
                          {entry.fields.map(field => (
                            <div key={field.name}>
                              <label className="text-[9px] opacity-50 block mb-0.5">
                                {field.label}{field.required && <span style={{ color: '#FF5A1F' }}> *</span>}
                              </label>
                              {field.type === 'password' ? (
                                <textarea
                                  value={formValues[field.name] || ''}
                                  onChange={e => setFormValues(p => ({ ...p, [field.name]: e.target.value }))}
                                  placeholder={field.placeholder}
                                  rows={3}
                                  className="w-full px-2 py-1 text-[10px] font-mono rounded-lg outline-none resize-y"
                                  style={{ background: '#0B0B0C', border: '1px solid #2A2A2E', color: '#F5F5F0' }}
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={formValues[field.name] || ''}
                                  onChange={e => setFormValues(p => ({ ...p, [field.name]: e.target.value }))}
                                  placeholder={field.placeholder}
                                  className="w-full px-2 py-1 text-[10px] rounded-lg outline-none"
                                  style={{ background: '#0B0B0C', border: '1px solid #2A2A2E', color: '#F5F5F0' }}
                                />
                              )}
                            </div>
                          ))}
                          {entry.confirmWarning && (
                            <div className="text-[9px] p-1.5 rounded" style={{ background: '#2A1717', color: '#FFB99A' }}>
                              ⚠️ {entry.confirmWarning}
                            </div>
                          )}
                          <div className="flex gap-1.5">
                            <button
                              id={`install-btn-${entry.id}`}
                              onClick={() => handleInstall(entry)}
                              disabled={submitting}
                              className="text-[10px] px-3 py-1 rounded-lg font-medium"
                              style={{ background: '#FF5A1F', color: '#0B0B0C', opacity: submitting ? 0.5 : 1 }}
                            >
                              {submitting ? '连接中...' : '确认'}
                            </button>
                            <button
                              onClick={() => { setInstallingId(null); setFormValues({}); }}
                              className="text-[10px] px-3 py-1 rounded-lg"
                              style={{ background: '#2A2A2E' }}
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Zero-config hidden submit */}
                      {isInstalling && entry.fields.length === 0 && (
                        <button
                          id={`install-btn-${entry.id}`}
                          onClick={() => handleInstall(entry)}
                          style={{ display: 'none' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div className="text-[10px] opacity-30 mt-6">
          凭证 AES-256-GCM 加密 · 浏览仅限 10 个白名单平台 · 自定义 MCP 安全自担
        </div>
      </main>

      <Toast value={toast} />
    </div>
  );
}

function QuotaCard({ label, used, limit }: { label: string; used: number; limit: number }) {
  const remaining = Math.max(0, limit - used);
  return (
    <div className="flex-1 rounded-lg p-3" style={{ background: '#17171A', border: '1px solid #2A2A2E' }}>
      <div className="text-[9px] uppercase tracking-widest opacity-40 mb-1">{label}</div>
      <div className="text-lg font-bold">
        <span style={{ color: remaining < 10 ? '#FF5A1F' : '#F5F5F0' }}>{used}</span>
        <span className="opacity-25 text-xs"> / {limit}</span>
      </div>
    </div>
  );
}

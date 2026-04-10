'use client';

// /account/skills — Skills Hub
//
// Unified entry point for all external capabilities:
// Webhooks (notification/automation) + Browse sites (data) + MCP tools.
// Replaces the three separate pages: /account/integrations,
// /account/browse-sites, /account/ai-tools.

import { useEffect, useState, useCallback } from 'react';
import { AppHeader, AccountSubNav } from '@/components/workspace/AppHeader';
import { Toast } from '@/components/ui/Toast';
import SkillIcon from '@/components/skills/SkillIcon';
import {
  SKILL_CATALOG,
  CATEGORY_LABELS,
  CONNECTION_METHOD_LABELS,
  type SkillCategory,
  type SkillCatalogEntry,
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
  webhookUrl?: string;
  browseSiteId?: string;
  expiresAt?: string | null;
}

interface Quota {
  browse: { used: number; limit: number };
  mcp: { used: number; limit: number };
}

type CatFilter = 'all' | SkillCategory;

export default function SkillsHubPage() {
  const [connected, setConnected] = useState<ConnectedSkill[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<CatFilter>('all');
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
    } catch { /* empty state handles it */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Install handlers (dispatch to the right backend by type) ──────

  async function handleInstall(entry: SkillCatalogEntry) {
    // Validate required fields
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
        // MCP
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
      if (!res.ok) {
        showToast(body.error || '操作失败', false);
        return;
      }
      showToast(`${entry.name} 已连接`, true);
      setInstallingId(null);
      setFormValues({});
      await refresh();
    } catch {
      showToast('网络错误', false);
    } finally {
      setSubmitting(false);
    }
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
    } catch {
      showToast('网络错误', false);
    }
  }

  async function handleToggle(skill: ConnectedSkill, enabled: boolean) {
    try {
      let url = '';
      if (skill.type === 'webhook') url = `/api/webhooks/${skill.instanceId}`;
      else if (skill.type === 'mcp') url = `/api/mcp/${skill.instanceId}`;
      else return; // browse has no toggle
      await fetch(url, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: enabled, enabled }),
      });
      await refresh();
    } catch {
      showToast('操作失败', false);
    }
  }

  // ── Filter catalog ────────────────────────────────────────────────

  const connectedIds = new Set(connected.map(c => c.skillId));
  const filteredCatalog = SKILL_CATALOG.filter(e =>
    catFilter === 'all' || e.category === catFilter,
  );

  const categories: CatFilter[] = ['all', 'notification', 'data', 'ai-tool', 'automation', 'dev'];

  return (
    <div className="min-h-screen" style={{ background: '#0B0B0C', color: '#F5F5F0' }}>
      <AppHeader />
      <AccountSubNav />

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero */}
        <div className="mb-8">
          <div className="text-xs uppercase tracking-widest opacity-60 mb-3">SKILLS HUB</div>
          <h1 className="text-4xl font-black tracking-tight mb-3" style={{ fontFamily: '"Cabinet Grotesk", system-ui, sans-serif' }}>
            技能中心
          </h1>
          <p className="text-sm leading-relaxed max-w-2xl opacity-75">
            扩展 Agent 的能力 — 连接外部服务推送通知、操作白名单网站抓取数据、安装 MCP 工具让 Agent 直接调用。
          </p>
        </div>

        {/* Quota */}
        {quota && (
          <div className="mb-10 flex gap-4">
            <QuotaCard label="浏览" used={quota.browse.used} limit={quota.browse.limit} />
            <QuotaCard label="MCP 工具" used={quota.mcp.used} limit={quota.mcp.limit} />
          </div>
        )}

        {/* Connected */}
        <div className="mb-10">
          <h2 className="text-lg font-bold mb-4">已连接 ({connected.length})</h2>
          {loading ? (
            <div className="opacity-60">加载中...</div>
          ) : connected.length === 0 ? (
            <div className="rounded-xl p-8 text-center text-sm opacity-50" style={{ background: '#17171A', border: '1px dashed #2A2A2E' }}>
              还没有连接任何技能。从下面选一个开始。
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {connected.map(skill => (
                <div
                  key={skill.instanceId}
                  className="rounded-xl p-4 flex items-start gap-3"
                  style={{ background: '#17171A', border: `1px solid ${skill.status === 'active' ? '#FF5A1F33' : '#2A2A2E'}`, opacity: skill.status === 'active' ? 1 : 0.6 }}
                >
                  <SkillIcon skillId={skill.icon} size={40} connected={skill.status === 'active'} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{skill.name}</div>
                    <div className="text-[10px] opacity-50 mt-0.5">
                      {skill.type === 'mcp' && skill.toolCount ? `${skill.toolCount} 个工具 · ` : ''}
                      {skill.lastUsedAt ? `上次 ${new Date(skill.lastUsedAt).toLocaleDateString('zh-CN')}` : '未使用'}
                    </div>
                    <div className="flex gap-2 mt-2">
                      {(skill.type === 'webhook' || skill.type === 'mcp') && (
                        <button
                          onClick={() => handleToggle(skill, skill.status !== 'active')}
                          className="text-[10px] px-2 py-0.5 rounded"
                          style={{ background: '#2A2A2E' }}
                        >
                          {skill.status === 'active' ? '禁用' : '启用'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDisconnect(skill)}
                        className="text-[10px] px-2 py-0.5 rounded"
                        style={{ color: '#E4483D' }}
                      >
                        断开
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category tabs */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: catFilter === cat ? '#FF5A1F' : '#17171A',
                color: catFilter === cat ? '#0B0B0C' : '#F5F5F0',
                border: `1px solid ${catFilter === cat ? '#FF5A1F' : '#2A2A2E'}`,
              }}
            >
              {cat === 'all' ? '全部' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Catalog */}
        <div className="mb-10">
          <h2 className="text-lg font-bold mb-4">可连接</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCatalog.map(entry => {
              const isInstalling = installingId === entry.id;
              const isConnected = connectedIds.has(entry.id);
              const method = CONNECTION_METHOD_LABELS[entry.connectionMethod];
              const isOAuthFuture = entry.connectionMethod === 'oauth' && !entry.fields.length;

              return (
                <div
                  key={entry.id}
                  className="rounded-xl p-4"
                  style={{ background: '#17171A', border: `1px solid ${isInstalling ? '#FF5A1F' : '#2A2A2E'}` }}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <SkillIcon skillId={entry.icon} size={40} connected={isConnected} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{entry.name}</span>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: `${method.color}20`, color: method.color, border: `1px solid ${method.color}40` }}
                        >
                          {method.label}
                        </span>
                      </div>
                      <div className="text-[11px] opacity-60 mt-1 line-clamp-2">{entry.description}</div>
                    </div>
                  </div>

                  {!isInstalling && (
                    <button
                      onClick={() => {
                        if (isOAuthFuture) { showToast('OAuth 连接即将上线,敬请期待', false); return; }
                        if (entry.preInstalled && !isConnected && entry.fields.length === 0) {
                          // Zero-config pre-installed: install directly
                          setInstallingId(entry.id);
                          setFormValues({});
                          // Auto-submit
                          setTimeout(() => {
                            const btn = document.getElementById(`install-btn-${entry.id}`);
                            btn?.click();
                          }, 100);
                          return;
                        }
                        setInstallingId(entry.id);
                        setFormValues({});
                      }}
                      disabled={isOAuthFuture}
                      className="w-full text-xs py-2 rounded-lg mt-2 font-medium transition-colors"
                      style={{
                        background: isOAuthFuture ? '#2A2A2E' : (isConnected ? '#2A2A2E' : '#FF5A1F'),
                        color: isOAuthFuture ? '#5A5A60' : (isConnected ? '#F5F5F0' : '#0B0B0C'),
                        cursor: isOAuthFuture ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isOAuthFuture ? '即将上线' : (isConnected ? '+ 再添一个' : (entry.preInstalled ? '一键启用' : '连接'))}
                    </button>
                  )}

                  {/* Inline install form */}
                  {isInstalling && (
                    <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid #2A2A2E' }}>
                      {entry.fields.map(field => (
                        <div key={field.name}>
                          <label className="text-[10px] opacity-60 block mb-1">
                            {field.label}{field.required && <span style={{ color: '#FF5A1F' }}> *</span>}
                          </label>
                          {field.type === 'password' ? (
                            <textarea
                              value={formValues[field.name] || ''}
                              onChange={e => setFormValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                              placeholder={field.placeholder}
                              rows={3}
                              className="w-full px-2 py-1.5 text-[11px] font-mono rounded-lg outline-none resize-y"
                              style={{ background: '#0B0B0C', border: '1px solid #2A2A2E', color: '#F5F5F0' }}
                            />
                          ) : (
                            <input
                              type="text"
                              value={formValues[field.name] || ''}
                              onChange={e => setFormValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                              placeholder={field.placeholder}
                              className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                              style={{ background: '#0B0B0C', border: '1px solid #2A2A2E', color: '#F5F5F0' }}
                            />
                          )}
                          {field.help && <div className="text-[9px] opacity-40 mt-0.5">{field.help}</div>}
                        </div>
                      ))}
                      {entry.confirmWarning && (
                        <div className="text-[10px] p-2 rounded-lg" style={{ background: '#2A1717', color: '#FFB99A' }}>
                          ⚠️ {entry.confirmWarning}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          id={`install-btn-${entry.id}`}
                          onClick={() => handleInstall(entry)}
                          disabled={submitting}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: '#FF5A1F', color: '#0B0B0C', opacity: submitting ? 0.5 : 1 }}
                        >
                          {submitting ? '连接中...' : '确认连接'}
                        </button>
                        <button
                          onClick={() => { setInstallingId(null); setFormValues({}); }}
                          className="text-xs px-3 py-1.5 rounded-lg"
                          style={{ background: '#2A2A2E' }}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="text-[11px] opacity-40 leading-relaxed">
          <p>所有凭证使用 AES-256-GCM 加密存储,密钥在服务端环境变量中。浏览站点仅支持 10 个白名单平台。自定义 MCP 运行任意代码,安全责任自担。</p>
        </div>
      </main>

      <Toast value={toast} />
    </div>
  );
}

function QuotaCard({ label, used, limit }: { label: string; used: number; limit: number }) {
  const remaining = Math.max(0, limit - used);
  return (
    <div className="flex-1 rounded-xl p-4" style={{ background: '#17171A', border: '1px solid #2A2A2E' }}>
      <div className="text-[10px] uppercase tracking-widest opacity-50 mb-1">{label}</div>
      <div className="text-xl font-bold">
        <span style={{ color: remaining < 10 ? '#FF5A1F' : '#F5F5F0' }}>{used}</span>
        <span className="opacity-30 text-sm"> / {limit}</span>
      </div>
    </div>
  );
}

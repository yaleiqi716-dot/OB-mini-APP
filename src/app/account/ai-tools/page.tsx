'use client';

// /account/ai-tools — Phase 5 chunk 5 UI
//
// MCP server management. Lets the user:
//   1. Browse the curated catalog of installable MCP servers
//   2. Install one via a per-kind field wizard
//   3. See their currently installed servers with tool counts
//   4. Test a server (re-probe + refresh cachedTools inline)
//   5. Toggle enabled / uninstall
//   6. See daily MCP quota usage
//
// Design system: DESIGN.md v1.2 tokens, same patterns as
// /account/browse-sites.

import { useEffect, useState, useCallback } from 'react';
import { AppHeader, AccountSubNav } from '@/components/workspace/AppHeader';
import { Toast } from '@/components/ui/Toast';

interface InstalledServer {
  id: string;
  name: string;
  kind: string;
  command: string | null;
  args: string | null;
  enabled: boolean;
  scopes: string[];
  tools: string[];
  toolCount: number;
  hasConfig: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

interface CatalogField {
  name: string;
  label: string;
  placeholder?: string;
  required: boolean;
  type: 'text' | 'path' | 'password';
  help?: string;
}

interface CatalogEntry {
  kind: string;
  label: string;
  tagline: string;
  description: string;
  scopes: string[];
  fields: CatalogField[];
  confirmWarning: string | null;
  icon: string;
}

interface Quota {
  used: number;
  limit: number;
  remaining: number;
  allowed: boolean;
}

interface TestResult {
  success: boolean;
  durationMs?: number;
  tools?: { name: string; description: string | null }[];
  error?: string;
}

export default function AiToolsPage() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [servers, setServers] = useState<InstalledServer[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [installingKind, setInstallingKind] = useState<string | null>(null);
  const [installConfig, setInstallConfig] = useState<Record<string, string>>({});
  const [installName, setInstallName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [cRes, sRes, qRes] = await Promise.all([
        fetch('/api/mcp/catalog'),
        fetch('/api/mcp'),
        fetch('/api/mcp/quota'),
      ]);
      if (cRes.ok) setCatalog(await cRes.json());
      if (sRes.ok) setServers(await sRes.json());
      if (qRes.ok) setQuota(await qRes.json());
    } catch {
      // ignore — empty states handle it
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function openInstall(kind: string) {
    setInstallingKind(kind);
    setInstallConfig({});
    const entry = catalog.find(c => c.kind === kind);
    setInstallName(entry?.label || '');
  }

  function closeInstall() {
    setInstallingKind(null);
    setInstallConfig({});
    setInstallName('');
  }

  async function handleInstall() {
    if (!installingKind) return;
    const entry = catalog.find(c => c.kind === installingKind);
    if (!entry) return;
    for (const field of entry.fields) {
      if (field.required && !installConfig[field.name]?.trim()) {
        showToast(`请填写 ${field.label}`, false);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/mcp/install', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: installingKind,
          name: installName.trim() || undefined,
          config: installConfig,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(body.error || '安装失败', false);
        return;
      }
      if (body.probeError) {
        showToast(`已安装,但测试连接失败: ${body.probeError.slice(0, 60)}`, false);
      } else {
        showToast(`已安装 ${body.name} (${body.toolCount} 个工具)`, true);
      }
      closeInstall();
      await refresh();
    } catch {
      showToast('网络错误', false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTest(id: string) {
    try {
      const res = await fetch(`/api/mcp/${id}/test`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      setTestResults(prev => ({ ...prev, [id]: body as TestResult }));
      if (body.success) {
        showToast(`测试成功,发现 ${body.tools?.length || 0} 个工具`, true);
        await refresh();
      } else {
        showToast(body.error || '测试失败', false);
      }
    } catch {
      showToast('网络错误', false);
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    try {
      await fetch(`/api/mcp/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      await refresh();
    } catch {
      showToast('操作失败', false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定卸载这个 MCP 服务器?使用它的对话将无法继续调用其工具。')) return;
    try {
      const res = await fetch(`/api/mcp/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || '删除失败', false);
        return;
      }
      showToast('已卸载', true);
      await refresh();
    } catch {
      showToast('网络错误', false);
    }
  }

  const installedKinds = new Set(servers.map(s => s.kind));

  return (
    <div className="min-h-screen" style={{ background: '#0B0B0C', color: '#F5F5F0' }}>
      <AppHeader />
      <AccountSubNav />

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero */}
        <div className="mb-10">
          <div className="text-xs uppercase tracking-widest opacity-60 mb-3">05 · AI TOOLS</div>
          <h1
            className="text-4xl font-black tracking-tight mb-3"
            style={{ fontFamily: '"Cabinet Grotesk", system-ui, sans-serif' }}
          >
            AI 工具 · MCP
          </h1>
          <p className="text-sm leading-relaxed max-w-2xl opacity-75">
            让 ORANGEBENCH agent 直接操作你的其他工具 —— 读写本地文件、查 SQLite、看 git 历史、用任意 MCP 服务器。
            安装的配置在本地加密存储,每次工具调用都写入审计日志,所有数据永远不离开你的实例。
          </p>
        </div>

        {/* Quota */}
        {quota && (
          <div
            className="mb-10 rounded-xl p-5 flex items-center justify-between"
            style={{ background: '#17171A', border: '1px solid #2A2A2E' }}
          >
            <div>
              <div className="text-xs uppercase tracking-widest opacity-60 mb-1">今日 MCP 调用额度</div>
              <div className="text-2xl font-bold">
                <span style={{ color: quota.remaining < 10 ? '#FF5A1F' : '#F5F5F0' }}>
                  {quota.used}
                </span>
                <span className="opacity-40"> / {quota.limit}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-60">剩余</div>
              <div className="text-xl font-mono" style={{ color: '#FF5A1F' }}>
                {quota.remaining}
              </div>
            </div>
          </div>
        )}

        {/* Installed */}
        <div className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl font-bold">已安装 ({servers.length})</h2>
          </div>
          {loading ? (
            <div className="opacity-60">加载中...</div>
          ) : servers.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center opacity-60"
              style={{ background: '#17171A', border: '1px dashed #2A2A2E' }}
            >
              还没安装任何 MCP 服务器。从下面的可安装列表中选一个开始。
            </div>
          ) : (
            <div className="space-y-3">
              {servers.map(srv => {
                const testRes = testResults[srv.id];
                return (
                  <div
                    key={srv.id}
                    className="rounded-xl p-5"
                    style={{
                      background: '#17171A',
                      border: `1px solid ${srv.enabled ? '#FF5A1F33' : '#2A2A2E'}`,
                      opacity: srv.enabled ? 1 : 0.6,
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-base font-bold">{srv.name}</h3>
                          <span
                            className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-mono"
                            style={{ background: '#2A2A2E', color: '#F5F5F0' }}
                          >
                            {srv.kind}
                          </span>
                          {!srv.enabled && (
                            <span
                              className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full"
                              style={{ background: '#3A2A2A', color: '#FF8F6F' }}
                            >
                              已禁用
                            </span>
                          )}
                        </div>
                        <div className="text-xs opacity-60 font-mono mb-2 truncate">
                          {srv.command} {srv.args || ''}
                        </div>
                        <div className="text-xs opacity-70">
                          <span className="mr-4">{srv.toolCount} 个工具</span>
                          <span className="mr-4">权限: {srv.scopes.join(' · ')}</span>
                          {srv.lastUsedAt && (
                            <span>上次使用 {new Date(srv.lastUsedAt).toLocaleDateString('zh-CN')}</span>
                          )}
                        </div>
                        {srv.tools.length > 0 && (
                          <div className="text-[10px] opacity-50 font-mono mt-2 truncate">
                            {srv.tools.slice(0, 8).join(' · ')}
                            {srv.tools.length > 8 && ` +${srv.tools.length - 8}`}
                          </div>
                        )}
                        {testRes?.success && testRes.tools && (
                          <div
                            className="text-[11px] mt-2 p-2 rounded-lg"
                            style={{ background: '#0B0B0C', color: '#F5F5F0' }}
                          >
                            测试通过 ({testRes.durationMs}ms) · 发现工具:
                            <div className="mt-1 opacity-80">
                              {testRes.tools.map(t => t.name).join(' · ')}
                            </div>
                          </div>
                        )}
                        {testRes && !testRes.success && (
                          <div
                            className="text-[11px] mt-2 p-2 rounded-lg"
                            style={{ background: '#2A1717', color: '#FF8F6F' }}
                          >
                            测试失败: {testRes.error}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <button
                          onClick={() => handleTest(srv.id)}
                          className="text-xs px-3 py-1.5 rounded-lg whitespace-nowrap"
                          style={{ background: '#2A2A2E', color: '#F5F5F0' }}
                        >
                          测试连接
                        </button>
                        <button
                          onClick={() => handleToggle(srv.id, !srv.enabled)}
                          className="text-xs px-3 py-1.5 rounded-lg whitespace-nowrap"
                          style={{ background: '#2A2A2E', color: '#F5F5F0' }}
                        >
                          {srv.enabled ? '禁用' : '启用'}
                        </button>
                        <button
                          onClick={() => handleDelete(srv.id)}
                          className="text-xs px-3 py-1.5 rounded-lg whitespace-nowrap"
                          style={{ color: '#FF5A1F' }}
                        >
                          卸载
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Catalog */}
        <div className="mb-10">
          <h2 className="text-xl font-bold mb-4">可安装</h2>
          <div className="space-y-3">
            {catalog.map(entry => {
              const already = installedKinds.has(entry.kind) && entry.kind !== 'custom';
              const opening = installingKind === entry.kind;
              return (
                <div
                  key={entry.kind}
                  className="rounded-xl p-5"
                  style={{
                    background: '#17171A',
                    border: `1px solid ${opening ? '#FF5A1F' : '#2A2A2E'}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-2xl">{entry.icon}</span>
                        <h3 className="text-base font-bold">{entry.label}</h3>
                        {entry.kind === 'custom' && (
                          <span
                            className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full"
                            style={{ background: '#3A2A2A', color: '#FF8F6F' }}
                          >
                            高级
                          </span>
                        )}
                      </div>
                      <div className="text-xs opacity-80 mb-1">{entry.tagline}</div>
                      <div className="text-xs opacity-60 leading-relaxed">{entry.description}</div>
                      <div className="text-[10px] opacity-50 mt-2">
                        权限: {entry.scopes.join(' · ')}
                      </div>
                    </div>
                    {!opening && (
                      <button
                        onClick={() => openInstall(entry.kind)}
                        className="text-xs px-3 py-1.5 rounded-lg whitespace-nowrap"
                        style={{
                          background: already ? '#2A2A2E' : '#FF5A1F',
                          color: already ? '#F5F5F0' : '#0B0B0C',
                        }}
                      >
                        {already ? '+ 再装一个' : '安装'}
                      </button>
                    )}
                  </div>

                  {/* Install wizard */}
                  {opening && (
                    <div
                      className="mt-4 pt-4 space-y-3"
                      style={{ borderTop: '1px solid #2A2A2E' }}
                    >
                      <input
                        type="text"
                        value={installName}
                        onChange={e => setInstallName(e.target.value)}
                        placeholder="服务器名称"
                        className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                        style={{ background: '#0B0B0C', border: '1px solid #2A2A2E', color: '#F5F5F0' }}
                      />
                      {entry.fields.map(field => (
                        <div key={field.name}>
                          <label className="text-xs opacity-70 block mb-1">
                            {field.label}
                            {field.required && <span style={{ color: '#FF5A1F' }}> *</span>}
                          </label>
                          {field.type === 'password' ? (
                            <textarea
                              value={installConfig[field.name] || ''}
                              onChange={e =>
                                setInstallConfig(prev => ({ ...prev, [field.name]: e.target.value }))
                              }
                              placeholder={field.placeholder}
                              rows={3}
                              className="w-full px-3 py-2 text-xs font-mono rounded-lg outline-none resize-y"
                              style={{ background: '#0B0B0C', border: '1px solid #2A2A2E', color: '#F5F5F0' }}
                            />
                          ) : (
                            <input
                              type="text"
                              value={installConfig[field.name] || ''}
                              onChange={e =>
                                setInstallConfig(prev => ({ ...prev, [field.name]: e.target.value }))
                              }
                              placeholder={field.placeholder}
                              className="w-full px-3 py-2 text-sm rounded-lg outline-none font-mono"
                              style={{ background: '#0B0B0C', border: '1px solid #2A2A2E', color: '#F5F5F0' }}
                            />
                          )}
                          {field.help && (
                            <div className="text-[11px] opacity-50 mt-1">{field.help}</div>
                          )}
                        </div>
                      ))}
                      {entry.confirmWarning && (
                        <div
                          className="text-xs p-3 rounded-lg"
                          style={{ background: '#2A1717', color: '#FFB99A' }}
                        >
                          ⚠️ {entry.confirmWarning}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={handleInstall}
                          disabled={submitting}
                          className="text-sm px-4 py-2 rounded-lg font-medium"
                          style={{
                            background: '#FF5A1F',
                            color: '#0B0B0C',
                            opacity: submitting ? 0.5 : 1,
                          }}
                        >
                          {submitting ? '安装中...' : '确认安装'}
                        </button>
                        <button
                          onClick={closeInstall}
                          className="text-sm px-4 py-2 rounded-lg"
                          style={{ background: '#2A2A2E', color: '#F5F5F0' }}
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
        <div className="text-xs opacity-50 leading-relaxed">
          <p className="mb-2">
            <strong className="opacity-75">安全说明:</strong>{' '}
            MCP 配置使用独立于浏览凭证的密钥加密 (AES-256-GCM, MCP_VAULT_KEY 环境变量)。
            每次工具调用都会写入审计日志, 永远不会被明文回显到前端。
          </p>
          <p>
            <strong className="opacity-75">自定义 MCP 警告:</strong>{' '}
            安装自定义命令等于运行任意代码。请确保你信任该命令的来源。
          </p>
        </div>
      </main>

      <Toast value={toast} />
    </div>
  );
}

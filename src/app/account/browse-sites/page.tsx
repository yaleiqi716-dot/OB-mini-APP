'use client';

// /account/browse-sites — Phase 4 chunk 5 UI
//
// Manages per-user browse credentials for the gstack browse tool.
// Lets the user:
//   1. See the whitelist catalog of 10 Chinese business platforms
//   2. See which sites they've connected (have a stored credential)
//   3. Add a new credential (paste cookie JSON, label it)
//   4. Delete an existing credential
//   5. See their daily browse quota usage
//
// Plaintext cookies leave the browser ONCE — on the POST. The server
// encrypts them via browse-vault.ts before the DB write. The list
// endpoint never returns ciphertext or plaintext.
//
// Follows DESIGN.md v1.2 tokens — no hardcoded hex values outside the
// design-system palette.

import { useEffect, useState, useCallback } from 'react';
import { AppHeader, AccountSubNav } from '@/components/workspace/AppHeader';
import { Toast } from '@/components/ui/Toast';

interface Credential {
  id: string;
  siteId: string;
  label: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface Site {
  id: string;
  label: string;
  description: string;
  loginUrl: string;
  hostnames: string[];
  capabilities: string[];
  actions: string[];
  credentials: Credential[];
}

interface Quota {
  used: number;
  limit: number;
  remaining: number;
  allowed: boolean;
}

export default function BrowseSitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingForSite, setAddingForSite] = useState<string | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formCookies, setFormCookies] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [sRes, qRes] = await Promise.all([
        fetch('/api/browse/sites'),
        fetch('/api/browse/quota'),
      ]);
      if (sRes.ok) setSites(await sRes.json());
      if (qRes.ok) setQuota(await qRes.json());
    } catch {
      // silently ignore — UI will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAdd(siteId: string) {
    if (!formLabel.trim() || !formCookies.trim()) {
      showToast('请填写备注和 cookies', false);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/browse/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          siteId,
          label: formLabel.trim(),
          cookies: formCookies,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || '保存失败', false);
        return;
      }
      showToast('凭证已加密保存', true);
      setAddingForSite(null);
      setFormLabel('');
      setFormCookies('');
      await refresh();
    } catch {
      showToast('网络错误', false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(credId: string) {
    if (!confirm('确定删除这个凭证?删除后该站点的浏览任务会立即失效。')) return;
    try {
      const res = await fetch(`/api/browse/credentials/${credId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || '删除失败', false);
        return;
      }
      showToast('已删除', true);
      await refresh();
    } catch {
      showToast('网络错误', false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#0B0B0C', color: '#F5F5F0' }}>
      <AppHeader />
      <AccountSubNav />

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero */}
        <div className="mb-10">
          <div className="text-xs uppercase tracking-widest opacity-60 mb-3">04 · BROWSE SITES</div>
          <h1 className="text-4xl font-black tracking-tight mb-3" style={{ fontFamily: '"Cabinet Grotesk", system-ui, sans-serif' }}>
            浏览站点
          </h1>
          <p className="text-sm leading-relaxed max-w-2xl opacity-75">
            授权 ORANGEBENCH 用你的账号访问这些平台,帮你自动拉数据、截图、抓正文。
            所有凭证在保存时用 AES-256-GCM 加密,只有浏览任务运行时才解密使用。我们永远
            不会在界面或 API 中明文回显你的 cookies。
          </p>
        </div>

        {/* Quota */}
        {quota && (
          <div
            className="mb-10 rounded-xl p-5 flex items-center justify-between"
            style={{ background: '#17171A', border: '1px solid #2A2A2E' }}
          >
            <div>
              <div className="text-xs uppercase tracking-widest opacity-60 mb-1">今日浏览额度</div>
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

        {/* Sites */}
        {loading ? (
          <div className="opacity-60">加载中...</div>
        ) : (
          <div className="space-y-4">
            {sites.map(site => {
              const isConnected = site.credentials.length > 0;
              const isAdding = addingForSite === site.id;
              return (
                <div
                  key={site.id}
                  className="rounded-xl p-6"
                  style={{
                    background: '#17171A',
                    border: `1px solid ${isConnected ? '#FF5A1F33' : '#2A2A2E'}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold">{site.label}</h3>
                        {isConnected && (
                          <span
                            className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full"
                            style={{ background: '#FF5A1F', color: '#0B0B0C' }}
                          >
                            已连接
                          </span>
                        )}
                      </div>
                      <p className="text-sm opacity-70 mb-2">{site.description}</p>
                      <div className="text-xs opacity-50 font-mono">
                        {site.hostnames.join(' · ')}
                      </div>
                    </div>
                    {!isAdding && (
                      <button
                        onClick={() => {
                          setAddingForSite(site.id);
                          setFormLabel(isConnected ? `备用号 ${site.credentials.length + 1}` : '主号');
                          setFormCookies('');
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg whitespace-nowrap"
                        style={{
                          background: isConnected ? '#2A2A2E' : '#FF5A1F',
                          color: isConnected ? '#F5F5F0' : '#0B0B0C',
                        }}
                      >
                        {isConnected ? '+ 添加账号' : '连接'}
                      </button>
                    )}
                  </div>

                  {/* Existing credentials */}
                  {site.credentials.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {site.credentials.map(cred => (
                        <div
                          key={cred.id}
                          className="flex items-center justify-between text-xs rounded-lg px-3 py-2"
                          style={{ background: '#0B0B0C' }}
                        >
                          <div>
                            <span className="font-medium">{cred.label}</span>
                            <span className="opacity-50 ml-3">
                              {cred.lastUsedAt
                                ? `上次使用 ${new Date(cred.lastUsedAt).toLocaleDateString('zh-CN')}`
                                : '未使用'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDelete(cred.id)}
                            className="opacity-60 hover:opacity-100"
                            style={{ color: '#FF5A1F' }}
                          >
                            删除
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add form */}
                  {isAdding && (
                    <div
                      className="mt-4 pt-4 space-y-3"
                      style={{ borderTop: '1px solid #2A2A2E' }}
                    >
                      <div className="text-xs opacity-70 leading-relaxed">
                        1. 在新窗口打开{' '}
                        <a
                          href={site.loginUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                          style={{ color: '#FF5A1F' }}
                        >
                          {site.label}登录页
                        </a>{' '}
                        并完成登录
                        <br />
                        2. 打开浏览器开发者工具 → Application → Cookies
                        <br />
                        3. 用 EditThisCookie 等插件导出 cookies 为 JSON
                        <br />
                        4. 粘贴到下方
                      </div>
                      <input
                        type="text"
                        value={formLabel}
                        onChange={e => setFormLabel(e.target.value)}
                        placeholder="凭证备注（如 主号 / 测试号）"
                        className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                        style={{ background: '#0B0B0C', border: '1px solid #2A2A2E', color: '#F5F5F0' }}
                      />
                      <textarea
                        value={formCookies}
                        onChange={e => setFormCookies(e.target.value)}
                        placeholder='[{"name": "session", "value": "...", "domain": ".feishu.cn", ...}, ...]'
                        rows={6}
                        className="w-full px-3 py-2 text-xs font-mono rounded-lg outline-none resize-y"
                        style={{ background: '#0B0B0C', border: '1px solid #2A2A2E', color: '#F5F5F0' }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAdd(site.id)}
                          disabled={submitting}
                          className="text-sm px-4 py-2 rounded-lg font-medium"
                          style={{
                            background: '#FF5A1F',
                            color: '#0B0B0C',
                            opacity: submitting ? 0.5 : 1,
                          }}
                        >
                          {submitting ? '加密保存中...' : '加密保存'}
                        </button>
                        <button
                          onClick={() => {
                            setAddingForSite(null);
                            setFormLabel('');
                            setFormCookies('');
                          }}
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
        )}

        {/* Footer note */}
        <div className="mt-12 text-xs opacity-50 leading-relaxed">
          <p className="mb-2">
            <strong className="opacity-75">安全说明:</strong>{' '}
            凭证用 AES-256-GCM 加密存储,主密钥在服务端环境变量中,不落盘任何明文副本。
            浏览任务运行时解密到内存,调用完成后最大化回收引用。UI 和 API 永远不明文回显。
          </p>
          <p>
            <strong className="opacity-75">白名单说明:</strong>{' '}
            出于安全,浏览工具仅支持上述 10 个白名单站点。如需添加新平台,请联系
            ORANGEBENCH 团队,我们会评估后加入下一个版本。
          </p>
        </div>
      </main>

      <Toast value={toast} />
    </div>
  );
}

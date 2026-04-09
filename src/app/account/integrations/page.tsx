'use client';

// /account/integrations — Phase 3 chunk 2 UI
//
// User-facing webhook management. Lets the user:
//   1. Pick a receiver type (Generic / 飞书 / 钉钉 / 企微) — type-first design
//      so the user understands what each is for before they configure
//   2. Paste the receiver URL + name + select event subscriptions
//   3. List active endpoints with status, last fired, failure count
//   4. Test fire a synthetic event
//   5. Delete endpoints
//
// Sits under the AccountSubNav tab strip alongside 概览 / 个人资料 / 订阅 / 偏好.
// Follows DESIGN.md v1.2 — token-driven, editorial spacing, no hardcoded hex.

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader, AccountSubNav } from '@/components/workspace/AppHeader';
import { Toast } from '@/components/ui/Toast';

interface WebhookEndpoint {
  id: string;
  kind: string;
  name: string;
  url: string; // already masked by API
  events: string[];
  active: boolean;
  failureCount: number;
  lastFiredAt: string | null;
  lastError: string | null;
  createdAt: string;
  hasSecret: boolean;
}

// Returned from POST /api/webhooks (create response). Includes the
// FULL secret value once — the list endpoint never returns this.
interface WebhookCreatedResponse extends WebhookEndpoint {
  secret?: string;
}

// Receiver type catalog — drives the type picker.
// Order is intentional: generic first (Zapier remains the headline path),
// then Chinese platforms in order of common use among Chinese SMBs.
const RECEIVER_KINDS = [
  {
    id: 'generic',
    label: 'Generic / Zapier',
    icon: '🔌',
    description: 'Zapier、webhook.site、n8n、任何 HTTPS 接收方。收到完整的 JSON envelope,可在 Zapier 里路由到 5000+ 个外部应用。',
    urlPlaceholder: 'https://hooks.zapier.com/hooks/catch/...',
    helpUrl: 'https://zapier.com/apps/webhook/integrations',
    helpText: '在 Zapier 里新建 Zap → 选 Trigger 为 "Webhooks by Zapier" → "Catch Hook" → 复制生成的 URL',
  },
  {
    id: 'feishu',
    label: '飞书群机器人',
    icon: '🚀',
    description: '飞书 / Lark 群里的自定义机器人。OB 会自动把事件转成飞书互动卡片(带颜色 + CTA 按钮),发送到群里。',
    urlPlaceholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/...',
    helpUrl: 'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/bot-v2/use-custom-bots-in-a-group',
    helpText: '飞书群 → 设置 → 群机器人 → 添加机器人 → 自定义机器人 → 复制 webhook 地址',
  },
  {
    id: 'dingtalk',
    label: '钉钉群机器人',
    icon: '🔔',
    description: '钉钉群里的自定义机器人。OB 会自动把事件转成钉钉 markdown 消息,发送到群里。',
    urlPlaceholder: 'https://oapi.dingtalk.com/robot/send?access_token=...',
    helpUrl: 'https://open.dingtalk.com/document/orgapp/custom-robot-access',
    helpText: '钉钉群 → 群设置 → 智能群助手 → 添加机器人 → 自定义 → 复制 webhook 地址',
  },
  {
    id: 'wecom',
    label: '企业微信群机器人',
    icon: '💼',
    description: '企业微信群里的自定义机器人。OB 会自动把事件转成企微 markdown 消息,发送到群里。',
    urlPlaceholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...',
    helpUrl: 'https://developer.work.weixin.qq.com/document/path/91770',
    helpText: '企业微信群 → 群设置 → 群机器人 → 添加机器人 → 复制 webhook 地址',
  },
] as const;

// Available event types — must match dispatcher.ts WebhookEvent
const EVENT_OPTIONS = [
  { id: 'task_assigned', label: '任务被分配', description: '老板把任务分配给某个员工时' },
  { id: 'task_submitted', label: '任务被提交', description: '员工提交交付物等待审核时' },
  { id: 'task_revision', label: '任务被退回', description: '老板退回任务要求修改时' },
  { id: 'task_completed', label: '任务通过审核', description: '老板审核通过任务完成时' },
] as const;

export default function IntegrationsPage() {
  const router = useRouter();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedKind, setSelectedKind] = useState<string>('generic');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(
    new Set(['task_assigned', 'task_submitted', 'task_completed']),
  );
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  // After successful create, the API returns the FULL signing secret ONCE.
  // We surface it in a banner that the user MUST acknowledge before it
  // disappears, so the user has a chance to copy it to their receiver
  // (Zapier filter / custom HTTPS verification middleware / etc).
  const [revealedSecret, setRevealedSecret] = useState<{
    endpointName: string;
    endpointId: string;
    secret: string;
  } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  }

  const loadEndpoints = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/webhooks');
      if (!r.ok) {
        if (r.status === 401) {
          router.replace('/login');
          return;
        }
        throw new Error('加载失败');
      }
      const data = await r.json();
      setEndpoints(Array.isArray(data) ? data : []);
    } catch {
      setEndpoints([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const hasSession = document.cookie.includes('ob-session=') || document.cookie.includes('ob-user-id=');
    if (!hasSession) {
      router.replace('/login');
      return;
    }
    loadEndpoints();
  }, [router, loadEndpoints]);

  const selectedKindMeta = RECEIVER_KINDS.find(k => k.id === selectedKind) || RECEIVER_KINDS[0];

  function resetForm() {
    setName('');
    setUrl('');
    setSelectedKind('generic');
    setSelectedEvents(new Set(['task_assigned', 'task_submitted', 'task_completed']));
    setShowAddForm(false);
  }

  async function handleAdd() {
    if (!name.trim() || !url.trim() || submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          kind: selectedKind,
          events: Array.from(selectedEvents),
        }),
      });
      const data = (await r.json()) as WebhookCreatedResponse | { error: string };
      if (!r.ok || 'error' in data) {
        showToast(('error' in data && data.error) || '添加失败', false);
        return;
      }
      showToast('已添加 webhook');
      // For generic kind, reveal the signing secret ONCE so the user can
      // copy it to their receiver. Chinese platforms don't read the
      // signature header so we skip the banner for them.
      if (data.kind === 'generic' && data.secret) {
        setRevealedSecret({
          endpointName: data.name,
          endpointId: data.id,
          secret: data.secret,
        });
      }
      resetForm();
      await loadEndpoints();
    } catch {
      showToast('网络错误', false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTest(id: string) {
    if (testingId) return;
    setTestingId(id);
    try {
      const r = await fetch(`/api/webhooks/${id}/test`, { method: 'POST' });
      const data = await r.json();
      if (data.success) {
        showToast(`✓ 测试成功 · ${data.statusCode} · ${data.durationMs}ms`);
      } else {
        showToast(`✗ ${data.errorMsg || data.message || '测试失败'}`, false);
      }
      await loadEndpoints();
    } catch {
      showToast('网络错误', false);
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    if (!window.confirm('确定要删除这个 webhook 订阅吗?对应的事件不会再发送到这个 URL。')) return;
    setDeletingId(id);
    try {
      const r = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        showToast(data.error || '删除失败', false);
        return;
      }
      showToast('已删除');
      await loadEndpoints();
    } catch {
      showToast('网络错误', false);
    } finally {
      setDeletingId(null);
    }
  }

  function toggleEvent(eventId: string) {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--ob-bg)', display: 'flex', flexDirection: 'column' }}>
      <AppHeader />
      <AccountSubNav />

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '40px 32px 80px' }}>
          {/* Hero */}
          <div style={{ marginBottom: 28 }}>
            <p
              style={{
                fontFamily: 'var(--ob-font-mono)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--ob-text-muted)',
                margin: '0 0 12px',
              }}
            >
              <span style={{ color: 'var(--ob-orange)' }}>04</span> · 集成 · WEBHOOK
            </p>
            <h1
              style={{
                fontFamily: 'var(--ob-font-display)',
                fontSize: 44,
                fontWeight: 800,
                color: 'var(--ob-text)',
                lineHeight: 1,
                letterSpacing: '-0.025em',
                margin: '0 0 12px',
              }}
            >
              对外通知 · 自动化
            </h1>
            <p style={{ fontSize: 14, color: 'var(--ob-text-muted)', maxWidth: 600, lineHeight: 1.6, margin: 0 }}>
              把 OrangeBench 的事件(任务分配 / 提交 / 审核 / 完成)推送到你的飞书 / 钉钉 / 企微群,或通过 Zapier 路由到 Slack / Notion / Sheets 等任何外部工具。
            </p>
          </div>

          {/* One-time secret reveal banner (after successful create of generic kind).
              The secret is shown ONCE — server doesn't return it again, so the user
              MUST copy it now. Acknowledging closes the banner. */}
          {revealedSecret && (
            <div
              style={{
                marginBottom: 28,
                padding: 20,
                background: 'var(--ob-orange-lo, rgba(255,90,31,0.10))',
                border: '1px solid var(--ob-orange)',
                borderRadius: 12,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--ob-font-mono)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--ob-orange)',
                  margin: '0 0 8px',
                }}
              >
                ⚠ 请立即复制签名密钥(仅显示一次)
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--ob-text)',
                  margin: '0 0 12px',
                  lineHeight: 1.5,
                }}
              >
                <strong>{revealedSecret.endpointName}</strong> · OrangeBench 会用这个密钥对每次发送的 payload 做 HMAC-SHA256 签名,
                你的 receiver 可以验证 payload 真的来自 OB。把它保存到你的 receiver 端(Zapier filter / 自建服务的环境变量)。
                <strong>关掉这个提示后服务器不再返回这个值</strong>。
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  background: 'var(--ob-bg)',
                  border: '1px solid var(--ob-border)',
                  borderRadius: 8,
                  marginBottom: 12,
                }}
              >
                <code
                  style={{
                    flex: 1,
                    fontFamily: 'var(--ob-font-mono)',
                    fontSize: 11,
                    color: 'var(--ob-text)',
                    wordBreak: 'break-all',
                    userSelect: 'all',
                  }}
                >
                  {revealedSecret.secret}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(revealedSecret.secret).then(() => {
                      showToast('密钥已复制到剪贴板');
                    }).catch(() => {
                      showToast('复制失败,请手动选中', false);
                    });
                  }}
                  style={{
                    height: 28,
                    padding: '0 12px',
                    borderRadius: 6,
                    background: 'var(--ob-orange)',
                    color: '#fff',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  📋 复制
                </button>
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: 'var(--ob-text-muted)',
                  margin: '0 0 12px',
                  fontFamily: 'var(--ob-font-mono)',
                }}
              >
                Header 名: <strong style={{ color: 'var(--ob-text)' }}>X-OrangeBench-Signature</strong>{' '}
                · 格式: <strong style={{ color: 'var(--ob-text)' }}>sha256=&lt;hex&gt;</strong>
              </p>
              <button
                type="button"
                onClick={() => setRevealedSecret(null)}
                style={{
                  height: 32,
                  padding: '0 16px',
                  borderRadius: 6,
                  background: 'var(--ob-text)',
                  color: 'var(--ob-bg)',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                我已复制,关闭
              </button>
            </div>
          )}

          {/* Add new — type picker */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                height: 40,
                padding: '0 20px',
                borderRadius: 8,
                background: 'var(--ob-orange)',
                color: '#fff',
                border: 'none',
                fontFamily: 'var(--ob-font-body)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: 28,
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
              添加新订阅
            </button>
          )}

          {showAddForm && (
            <div
              style={{
                marginBottom: 32,
                padding: 24,
                background: 'var(--ob-surface)',
                border: '1px solid var(--ob-border)',
                borderRadius: 16,
              }}
            >
              {/* Step 1: Type picker */}
              <div style={{ marginBottom: 24 }}>
                <p
                  style={{
                    fontFamily: 'var(--ob-font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--ob-text-muted)',
                    margin: '0 0 12px',
                  }}
                >
                  Step 1 · 选择接收平台
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 10,
                  }}
                >
                  {RECEIVER_KINDS.map(kind => {
                    const active = selectedKind === kind.id;
                    return (
                      <button
                        key={kind.id}
                        type="button"
                        onClick={() => setSelectedKind(kind.id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 6,
                          padding: '12px 14px',
                          background: active ? 'var(--ob-orange-lo, rgba(255,90,31,0.10))' : 'var(--ob-surface-hi)',
                          border: active ? '1px solid var(--ob-orange)' : '1px solid var(--ob-border)',
                          borderRadius: 12,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all .12s cubic-bezier(.2,.7,.3,1)',
                        }}
                      >
                        <span style={{ fontSize: 18, lineHeight: 1 }}>{kind.icon}</span>
                        <span
                          style={{
                            fontFamily: 'var(--ob-font-body)',
                            fontSize: 13,
                            fontWeight: 600,
                            color: active ? 'var(--ob-orange)' : 'var(--ob-text)',
                          }}
                        >
                          {kind.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: URL + name */}
              <div style={{ marginBottom: 20 }}>
                <p
                  style={{
                    fontFamily: 'var(--ob-font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--ob-text-muted)',
                    margin: '0 0 8px',
                  }}
                >
                  Step 2 · 粘贴 webhook URL
                </p>
                <p style={{ fontSize: 12, color: 'var(--ob-text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                  {selectedKindMeta.description}
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--ob-text-dim)',
                    margin: '0 0 14px',
                    padding: '10px 12px',
                    background: 'var(--ob-surface-hi)',
                    borderLeft: '2px solid var(--ob-orange)',
                    borderRadius: 4,
                    lineHeight: 1.5,
                  }}
                >
                  💡 {selectedKindMeta.helpText} ·{' '}
                  <a
                    href={selectedKindMeta.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--ob-orange)', textDecoration: 'underline' }}
                  >
                    官方文档
                  </a>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="名称(给自己看,例如:产品组飞书群)"
                    style={{
                      width: '100%',
                      height: 40,
                      padding: '0 14px',
                      borderRadius: 8,
                      border: '1px solid var(--ob-border)',
                      background: 'var(--ob-bg)',
                      color: 'var(--ob-text)',
                      fontSize: 14,
                      fontFamily: 'var(--ob-font-body)',
                      outline: 'none',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--ob-orange)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--ob-border)')}
                  />
                  <input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder={selectedKindMeta.urlPlaceholder}
                    style={{
                      width: '100%',
                      height: 40,
                      padding: '0 14px',
                      borderRadius: 8,
                      border: '1px solid var(--ob-border)',
                      background: 'var(--ob-bg)',
                      color: 'var(--ob-text)',
                      fontSize: 13,
                      fontFamily: 'var(--ob-font-mono)',
                      outline: 'none',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--ob-orange)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--ob-border)')}
                  />
                </div>
              </div>

              {/* Step 3: Event selection */}
              <div style={{ marginBottom: 24 }}>
                <p
                  style={{
                    fontFamily: 'var(--ob-font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--ob-text-muted)',
                    margin: '0 0 12px',
                  }}
                >
                  Step 3 · 选择要订阅的事件
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {EVENT_OPTIONS.map(opt => {
                    const checked = selectedEvents.has(opt.id);
                    return (
                      <label
                        key={opt.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          padding: '10px 12px',
                          background: checked ? 'var(--ob-orange-lo, rgba(255,90,31,0.10))' : 'var(--ob-surface-hi)',
                          border: checked ? '1px solid var(--ob-orange)' : '1px solid var(--ob-border)',
                          borderRadius: 8,
                          cursor: 'pointer',
                          transition: 'all .12s cubic-bezier(.2,.7,.3,1)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEvent(opt.id)}
                          style={{ marginTop: 2, accentColor: 'var(--ob-orange)' }}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ob-text)' }}>{opt.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--ob-text-muted)', marginTop: 2 }}>{opt.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Submit */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleAdd}
                  disabled={!name.trim() || !url.trim() || selectedEvents.size === 0 || submitting}
                  style={{
                    height: 40,
                    padding: '0 24px',
                    borderRadius: 8,
                    background: 'var(--ob-orange)',
                    color: '#fff',
                    border: 'none',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: !name.trim() || !url.trim() || selectedEvents.size === 0 || submitting ? 0.5 : 1,
                  }}
                >
                  {submitting ? '添加中...' : '添加'}
                </button>
                <button
                  onClick={resetForm}
                  style={{
                    height: 40,
                    padding: '0 20px',
                    borderRadius: 8,
                    background: 'transparent',
                    color: 'var(--ob-text-muted)',
                    border: '1px solid var(--ob-border)',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* Endpoint list */}
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ob-text-muted)', fontSize: 13 }}>
              加载中...
            </div>
          )}

          {!loading && endpoints && endpoints.length === 0 && !showAddForm && (
            <div
              style={{
                padding: '48px 32px',
                textAlign: 'center',
                background: 'var(--ob-surface)',
                border: '1px dashed var(--ob-border)',
                borderRadius: 16,
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>🪝</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ob-text)', margin: '0 0 6px' }}>
                还没有任何 webhook 订阅
              </p>
              <p style={{ fontSize: 13, color: 'var(--ob-text-muted)', margin: '0 0 20px', lineHeight: 1.6, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
                添加一个 webhook,让 OrangeBench 在任务事件发生时自动通知你的飞书 / 钉钉 / 企微群,或路由到 Zapier。
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                style={{
                  height: 38,
                  padding: '0 22px',
                  borderRadius: 8,
                  background: 'var(--ob-orange)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                添加第一个 webhook →
              </button>
            </div>
          )}

          {!loading && endpoints && endpoints.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {endpoints.map(ep => {
                const kindMeta = RECEIVER_KINDS.find(k => k.id === ep.kind) || RECEIVER_KINDS[0];
                return (
                  <div
                    key={ep.id}
                    style={{
                      padding: 18,
                      background: 'var(--ob-surface)',
                      border: '1px solid var(--ob-border)',
                      borderRadius: 12,
                      opacity: ep.active ? 1 : 0.6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
                      <div style={{ fontSize: 24, lineHeight: 1, marginTop: 2 }}>{kindMeta.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ob-text)' }}>{ep.name}</span>
                          <span
                            style={{
                              fontFamily: 'var(--ob-font-mono)',
                              fontSize: 9,
                              fontWeight: 600,
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: 9999,
                              background: ep.active ? 'var(--ob-orange-lo, rgba(255,90,31,0.10))' : 'var(--ob-surface-hi)',
                              color: ep.active ? 'var(--ob-orange)' : 'var(--ob-text-dim)',
                            }}
                          >
                            {ep.active ? 'ACTIVE' : 'DISABLED'}
                          </span>
                          {ep.failureCount > 0 && (
                            <span
                              style={{
                                fontFamily: 'var(--ob-font-mono)',
                                fontSize: 9,
                                fontWeight: 600,
                                letterSpacing: '0.12em',
                                color: 'var(--ob-error, #E4483D)',
                              }}
                            >
                              {ep.failureCount} FAILURES
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--ob-font-mono)',
                            fontSize: 11,
                            color: 'var(--ob-text-muted)',
                            wordBreak: 'break-all',
                            marginBottom: 6,
                          }}
                        >
                          {ep.url}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                          {ep.events.length === 0 ? (
                            <span
                              style={{
                                fontFamily: 'var(--ob-font-mono)',
                                fontSize: 9,
                                letterSpacing: '0.1em',
                                color: 'var(--ob-text-dim)',
                              }}
                            >
                              ALL EVENTS
                            </span>
                          ) : (
                            ep.events.map(e => (
                              <span
                                key={e}
                                style={{
                                  fontFamily: 'var(--ob-font-mono)',
                                  fontSize: 9,
                                  fontWeight: 500,
                                  padding: '2px 8px',
                                  borderRadius: 9999,
                                  background: 'var(--ob-surface-hi)',
                                  color: 'var(--ob-text-muted)',
                                  border: '1px solid var(--ob-border)',
                                }}
                              >
                                {e}
                              </span>
                            ))
                          )}
                        </div>
                        {ep.lastFiredAt && (
                          <div style={{ fontSize: 10, color: 'var(--ob-text-dim)' }}>
                            最近触发:{new Date(ep.lastFiredAt).toLocaleString('zh-CN')}
                            {ep.lastError && ` · 错误:${ep.lastError.slice(0, 60)}`}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--ob-border)' }}>
                      <button
                        onClick={() => handleTest(ep.id)}
                        disabled={testingId !== null}
                        style={{
                          height: 30,
                          padding: '0 14px',
                          borderRadius: 6,
                          background: 'var(--ob-surface-hi)',
                          color: 'var(--ob-text)',
                          border: '1px solid var(--ob-border)',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: testingId !== null ? 'not-allowed' : 'pointer',
                          opacity: testingId !== null && testingId !== ep.id ? 0.4 : 1,
                        }}
                      >
                        {testingId === ep.id ? '测试中...' : '🧪 测试'}
                      </button>
                      <button
                        onClick={() => handleDelete(ep.id)}
                        disabled={deletingId !== null}
                        style={{
                          height: 30,
                          padding: '0 14px',
                          borderRadius: 6,
                          background: 'transparent',
                          color: 'var(--ob-error, #E4483D)',
                          border: '1px solid var(--ob-border)',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: deletingId !== null ? 'not-allowed' : 'pointer',
                          marginLeft: 'auto',
                        }}
                      >
                        {deletingId === ep.id ? '删除中...' : '删除'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Toast value={toast} />
    </div>
  );
}

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

// Inbound webhook subscription — opposite direction. External system
// (Zapier / n8n / curl) POSTs to OB and triggers a Task creation.
interface InboundEndpoint {
  id: string;
  name: string;
  action: string;
  active: boolean;
  url: string;
  callCount: number;
  failureCount: number;
  lastFiredAt: string | null;
  createdAt: string;
  hasSecret: boolean;
}

interface InboundCreatedResponse extends InboundEndpoint {
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

// Quick-add templates — prefill the form with sensible defaults so the user
// only needs to paste their URL. Each template selects:
//   - kind (which receiver type)
//   - default name (user can change)
//   - default subscribed events
//   - description shown in the card
// The template DOES NOT include a URL — user pastes their own from
// Zapier / 飞书 / 钉钉 / 企微 / Slack / etc.
//
// Categories help group cards in the grid:
//   '中国本土' → 飞书 / 钉钉 / 企微 (use kind=feishu/dingtalk/wecom)
//   '国际'    → Slack / Notion / Sheets / Gmail (use kind=generic via Zapier)
//   '通用'    → custom HTTP, n8n, webhook.site
const TEMPLATES = [
  // 中国本土 (3) — direct platform integrations, no Zapier middleman
  {
    id: 'feishu-team',
    category: '中国本土',
    icon: '🚀',
    label: '飞书群通知',
    description: '把所有任务事件发送到飞书团队群,自动渲染成带颜色的互动卡片。',
    defaultName: '飞书团队群',
    kind: 'feishu',
    events: ['task_assigned', 'task_submitted', 'task_revision', 'task_completed'],
  },
  {
    id: 'dingtalk-team',
    category: '中国本土',
    icon: '🔔',
    label: '钉钉群通知',
    description: '把所有任务事件发送到钉钉群,markdown 格式,带跳转链接。',
    defaultName: '钉钉团队群',
    kind: 'dingtalk',
    events: ['task_assigned', 'task_submitted', 'task_revision', 'task_completed'],
  },
  {
    id: 'wecom-team',
    category: '中国本土',
    icon: '💼',
    label: '企业微信群通知',
    description: '把所有任务事件发送到企业微信群,markdown 格式,适合微信生态客户。',
    defaultName: '企业微信团队群',
    kind: 'wecom',
    events: ['task_assigned', 'task_submitted', 'task_revision', 'task_completed'],
  },

  // 国际平台 via Zapier (4)
  {
    id: 'slack-via-zapier',
    category: '国际',
    icon: '💬',
    label: 'Slack 通知 (via Zapier)',
    description: '通过 Zapier 把任务事件发到 Slack 频道。在 Zapier 选 "Webhooks by Zapier" → "Slack" 后复制 webhook URL 进来。',
    defaultName: 'Slack #team',
    kind: 'generic',
    events: ['task_assigned', 'task_submitted', 'task_completed'],
  },
  {
    id: 'notion-archive',
    category: '国际',
    icon: '📝',
    label: 'Notion 归档 (via Zapier)',
    description: '员工提交任务后,通过 Zapier 把交付内容自动存入 Notion 数据库。订阅 task_submitted 即可。',
    defaultName: 'Notion 任务归档',
    kind: 'generic',
    events: ['task_submitted', 'task_completed'],
  },
  {
    id: 'sheets-log',
    category: '国际',
    icon: '📊',
    label: 'Google Sheets 任务日志 (via Zapier)',
    description: '所有 OB 任务事件自动追加到 Google Sheets 一行,适合做内部统计 / 周报数据源。',
    defaultName: 'Sheets 任务日志',
    kind: 'generic',
    events: ['task_assigned', 'task_submitted', 'task_revision', 'task_completed'],
  },
  {
    id: 'gmail-weekly',
    category: '国际',
    icon: '📧',
    label: 'Gmail 任务通知 (via Zapier)',
    description: '通过 Zapier 把任务事件邮件发送给指定收件人。适合不在 OB 里、需要邮件通知的干系人。',
    defaultName: 'Gmail 任务通知',
    kind: 'generic',
    events: ['task_assigned', 'task_completed'],
  },

  // 通用 (3)
  {
    id: 'custom-https',
    category: '通用',
    icon: '🔌',
    label: '自建 HTTPS 接收方',
    description: '自己写的服务、内部系统、任何接受 JSON POST 的 endpoint。带 HMAC 签名,可以验证来源。',
    defaultName: '自建 webhook',
    kind: 'generic',
    events: ['task_assigned', 'task_submitted', 'task_revision', 'task_completed'],
  },
  {
    id: 'n8n-self-hosted',
    category: '通用',
    icon: '🛠',
    label: 'n8n (自托管自动化)',
    description: '把 OB 事件喂给 self-hosted n8n,做更复杂的多步自动化(类似开源版 Zapier)。',
    defaultName: 'n8n workflow',
    kind: 'generic',
    events: ['task_assigned', 'task_submitted', 'task_revision', 'task_completed'],
  },
  {
    id: 'webhook-site-debug',
    category: '通用',
    icon: '🧪',
    label: 'webhook.site (调试用)',
    description: '免注册的 webhook 接收方,用来看 OB 实际发出去的 payload 长什么样。开发调试必备。',
    defaultName: 'webhook.site 调试',
    kind: 'generic',
    events: ['task_assigned', 'task_submitted', 'task_revision', 'task_completed'],
  },
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
  // When editing an existing endpoint, this holds its id. Form fields
  // are reused (name, selectedKind, selectedEvents) but URL is locked
  // for edit (changing the URL is a delete + recreate, not a PATCH —
  // the secret would need rotation otherwise).
  const [editingId, setEditingId] = useState<string | null>(null);
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

  // Inbound endpoints (opposite direction) — Zapier/n8n/curl POSTs into OB.
  const [inbounds, setInbounds] = useState<InboundEndpoint[] | null>(null);
  const [showInboundForm, setShowInboundForm] = useState(false);
  const [inboundName, setInboundName] = useState('');
  const [inboundSubmitting, setInboundSubmitting] = useState(false);
  const [revealedInbound, setRevealedInbound] = useState<{
    name: string;
    url: string;
    secret: string;
  } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  }

  const loadEndpoints = useCallback(async () => {
    setLoading(true);
    try {
      const [outR, inR] = await Promise.all([
        fetch('/api/webhooks'),
        fetch('/api/webhooks/inbound'),
      ]);
      if (!outR.ok) {
        if (outR.status === 401) {
          router.replace('/login');
          return;
        }
        throw new Error('加载失败');
      }
      const outData = await outR.json();
      setEndpoints(Array.isArray(outData) ? outData : []);
      if (inR.ok) {
        const inData = await inR.json();
        setInbounds(Array.isArray(inData) ? inData : []);
      } else {
        setInbounds([]);
      }
    } catch {
      setEndpoints([]);
      setInbounds([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Inbound CRUD handlers
  async function handleAddInbound() {
    if (!inboundName.trim() || inboundSubmitting) return;
    setInboundSubmitting(true);
    try {
      const r = await fetch('/api/webhooks/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inboundName.trim() }),
      });
      const data = (await r.json()) as InboundCreatedResponse | { error: string };
      if (!r.ok || 'error' in data) {
        showToast(('error' in data && data.error) || '添加失败', false);
        return;
      }
      showToast('已添加入站 webhook');
      // Reveal both URL + secret once — user needs both to wire up Zapier.
      if (data.secret) {
        setRevealedInbound({
          name: data.name,
          url: data.url,
          secret: data.secret,
        });
      }
      setInboundName('');
      setShowInboundForm(false);
      await loadEndpoints();
    } catch {
      showToast('网络错误', false);
    } finally {
      setInboundSubmitting(false);
    }
  }

  async function handleDeleteInbound(id: string) {
    if (!window.confirm('确定要删除这个入站 webhook 吗?对应的 URL 会立刻失效。')) return;
    try {
      const r = await fetch(`/api/webhooks/inbound/manage/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        showToast(data.error || '删除失败', false);
        return;
      }
      showToast('已删除');
      await loadEndpoints();
    } catch {
      showToast('网络错误', false);
    }
  }

  async function handleToggleInboundActive(ep: InboundEndpoint) {
    try {
      const r = await fetch(`/api/webhooks/inbound/manage/${ep.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !ep.active }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        showToast(data.error || '操作失败', false);
        return;
      }
      showToast(ep.active ? '已暂停' : '已启用');
      await loadEndpoints();
    } catch {
      showToast('网络错误', false);
    }
  }

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
    setEditingId(null);
  }

  // Open the form pre-filled with an existing endpoint's values for editing.
  // URL stays locked because changing it would invalidate the secret;
  // for URL changes, user should delete + recreate.
  function openEditForm(ep: WebhookEndpoint) {
    setEditingId(ep.id);
    setName(ep.name);
    setUrl(ep.url); // masked URL just for display; PATCH won't accept it back
    setSelectedKind(ep.kind);
    setSelectedEvents(new Set(ep.events));
    setShowAddForm(true);
    // Scroll to top so the user sees the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // One-click template prefill — opens the form with kind+name+events
  // already filled in. URL is left blank so the user only has to paste
  // their actual receiver URL. Templates have NO URL because that's the
  // one piece that varies per user (their personal Slack channel,
  // their company's 飞书 group, etc).
  function useTemplate(template: typeof TEMPLATES[number]) {
    setEditingId(null);
    setSelectedKind(template.kind);
    setName(template.defaultName);
    setUrl('');
    setSelectedEvents(new Set(template.events));
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleAdd() {
    if (!name.trim() || submitting) return;
    // For edit mode, URL is read-only — user can't change it via PATCH.
    // For create mode, URL is required.
    if (!editingId && !url.trim()) return;
    setSubmitting(true);
    try {
      // Edit path: PATCH with name + events. URL + kind are immutable post-create.
      if (editingId) {
        const r = await fetch(`/api/webhooks/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            events: Array.from(selectedEvents),
          }),
        });
        const data = await r.json();
        if (!r.ok) {
          showToast(data.error || '更新失败', false);
          return;
        }
        showToast('已保存');
        resetForm();
        await loadEndpoints();
        return;
      }

      // Create path
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

  // Toggle active state via PATCH. Used by the "暂停/启用" button on each row.
  async function handleToggleActive(ep: WebhookEndpoint) {
    try {
      const r = await fetch(`/api/webhooks/${ep.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !ep.active }),
      });
      const data = await r.json();
      if (!r.ok) {
        showToast(data.error || '操作失败', false);
        return;
      }
      showToast(ep.active ? '已暂停' : '已启用');
      await loadEndpoints();
    } catch {
      showToast('网络错误', false);
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

          {/* Templates section — visible when form is closed.
              Quick-add cards prefill the form with kind+name+events,
              user just pastes their URL afterward. */}
          {!showAddForm && (
            <div style={{ marginBottom: 36 }}>
              <p
                style={{
                  fontFamily: 'var(--ob-font-mono)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--ob-text-muted)',
                  margin: '0 0 14px',
                }}
              >
                <span style={{ color: 'var(--ob-orange)' }}>常用模板</span> · 一键预填,你只需粘贴 URL
              </p>
              {/* Group templates by category */}
              {(['中国本土', '国际', '通用'] as const).map(category => {
                const items = TEMPLATES.filter(t => t.category === category);
                if (items.length === 0) return null;
                return (
                  <div key={category} style={{ marginBottom: 18 }}>
                    <p
                      style={{
                        fontFamily: 'var(--ob-font-mono)',
                        fontSize: 9,
                        fontWeight: 500,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'var(--ob-text-dim)',
                        margin: '0 0 8px',
                      }}
                    >
                      {category}
                    </p>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 10,
                      }}
                    >
                      {items.map(template => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => useTemplate(template)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: 6,
                            padding: '14px 16px',
                            background: 'var(--ob-surface)',
                            border: '1px solid var(--ob-border)',
                            borderRadius: 12,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all .12s cubic-bezier(.2,.7,.3,1)',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--ob-orange)';
                            e.currentTarget.style.background = 'var(--ob-surface-hi)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--ob-border)';
                            e.currentTarget.style.background = 'var(--ob-surface)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                            <span style={{ fontSize: 18, lineHeight: 1 }}>{template.icon}</span>
                            <span
                              style={{
                                fontFamily: 'var(--ob-font-body)',
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'var(--ob-text)',
                                flex: 1,
                              }}
                            >
                              {template.label}
                            </span>
                          </div>
                          <p
                            style={{
                              fontSize: 11,
                              color: 'var(--ob-text-muted)',
                              margin: 0,
                              lineHeight: 1.5,
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {template.description}
                          </p>
                          <div
                            style={{
                              display: 'flex',
                              gap: 4,
                              flexWrap: 'wrap',
                              marginTop: 4,
                            }}
                          >
                            {template.events.map(e => (
                              <span
                                key={e}
                                style={{
                                  fontFamily: 'var(--ob-font-mono)',
                                  fontSize: 8,
                                  fontWeight: 500,
                                  padding: '1px 6px',
                                  borderRadius: 9999,
                                  background: 'var(--ob-surface-hi)',
                                  color: 'var(--ob-text-dim)',
                                  border: '1px solid var(--ob-border)',
                                }}
                              >
                                {e}
                              </span>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
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
              {/* Edit mode banner — explains what's locked */}
              {editingId && (
                <div
                  style={{
                    marginBottom: 20,
                    padding: '12px 14px',
                    background: 'var(--ob-surface-hi)',
                    borderLeft: '2px solid var(--ob-orange)',
                    borderRadius: 4,
                    fontSize: 12,
                    color: 'var(--ob-text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: 'var(--ob-text)' }}>编辑模式</strong> · 你只能改名字和订阅事件。URL 和接收平台改不了
                  (会让签名密钥失效)。要换 URL 请删除后重新创建。
                </div>
              )}
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
                    const lockedByEdit = editingId !== null && !active;
                    return (
                      <button
                        key={kind.id}
                        type="button"
                        onClick={() => !editingId && setSelectedKind(kind.id)}
                        disabled={lockedByEdit}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 6,
                          padding: '12px 14px',
                          background: active ? 'var(--ob-orange-lo, rgba(255,90,31,0.10))' : 'var(--ob-surface-hi)',
                          border: active ? '1px solid var(--ob-orange)' : '1px solid var(--ob-border)',
                          borderRadius: 12,
                          cursor: lockedByEdit ? 'not-allowed' : 'pointer',
                          opacity: lockedByEdit ? 0.3 : 1,
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
                    onChange={e => !editingId && setUrl(e.target.value)}
                    readOnly={editingId !== null}
                    placeholder={selectedKindMeta.urlPlaceholder}
                    title={editingId ? '编辑模式下 URL 不可改' : ''}
                    style={{
                      width: '100%',
                      height: 40,
                      padding: '0 14px',
                      borderRadius: 8,
                      border: '1px solid var(--ob-border)',
                      background: editingId ? 'var(--ob-surface-hi)' : 'var(--ob-bg)',
                      color: editingId ? 'var(--ob-text-muted)' : 'var(--ob-text)',
                      fontSize: 13,
                      fontFamily: 'var(--ob-font-mono)',
                      outline: 'none',
                      cursor: editingId ? 'not-allowed' : 'text',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = editingId ? 'var(--ob-border)' : 'var(--ob-orange)')}
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
                  disabled={!name.trim() || (!editingId && !url.trim()) || selectedEvents.size === 0 || submitting}
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
                    opacity:
                      !name.trim() || (!editingId && !url.trim()) || selectedEvents.size === 0 || submitting ? 0.5 : 1,
                  }}
                >
                  {submitting
                    ? editingId ? '保存中...' : '添加中...'
                    : editingId ? '保存修改' : '添加'}
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
                        onClick={() => openEditForm(ep)}
                        style={{
                          height: 30,
                          padding: '0 14px',
                          borderRadius: 6,
                          background: 'var(--ob-surface-hi)',
                          color: 'var(--ob-text)',
                          border: '1px solid var(--ob-border)',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        ✏️ 编辑
                      </button>
                      <button
                        onClick={() => handleToggleActive(ep)}
                        style={{
                          height: 30,
                          padding: '0 14px',
                          borderRadius: 6,
                          background: 'var(--ob-surface-hi)',
                          color: 'var(--ob-text-muted)',
                          border: '1px solid var(--ob-border)',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        {ep.active ? '⏸ 暂停' : '▶ 启用'}
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

          {/* ── INBOUND SECTION ── */}
          <div style={{ marginTop: 56, paddingTop: 36, borderTop: '1px solid var(--ob-border)' }}>
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
              <span style={{ color: 'var(--ob-orange)' }}>05</span> · 入站 · INBOUND
            </p>
            <h2
              style={{
                fontFamily: 'var(--ob-font-display)',
                fontSize: 32,
                fontWeight: 800,
                color: 'var(--ob-text)',
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                margin: '0 0 12px',
              }}
            >
              外部系统创建任务
            </h2>
            <p style={{ fontSize: 13, color: 'var(--ob-text-muted)', maxWidth: 600, lineHeight: 1.6, margin: '0 0 24px' }}>
              生成一个 OB 入站 URL,贴给 Zapier / n8n / 自建脚本。它们用 HTTP POST 把任务输入发到这个 URL 上,OB 自动在 /agent 里替你创建一个任务,跑完通过出站 webhook(上面那部分)再通知你。这是 OB ↔ 外部世界的双向闭环。
            </p>

            {/* One-time inbound secret reveal banner */}
            {revealedInbound && (
              <div
                style={{
                  marginBottom: 24,
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
                  ⚠ 入站 URL + 密钥 (仅显示一次)
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--ob-text)',
                    margin: '0 0 12px',
                    lineHeight: 1.5,
                  }}
                >
                  <strong>{revealedInbound.name}</strong> · 把下面的 URL + 密钥保存到你的 caller 端。
                  调用方需要在 HTTP header 里带上密钥,否则 OB 会拒绝请求。
                </p>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, color: 'var(--ob-text-muted)', margin: '0 0 4px' }}>POST URL</p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      background: 'var(--ob-bg)',
                      border: '1px solid var(--ob-border)',
                      borderRadius: 8,
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
                      {revealedInbound.url}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(revealedInbound.url).then(() => {
                          showToast('URL 已复制');
                        }).catch(() => showToast('复制失败', false));
                      }}
                      style={{
                        height: 26,
                        padding: '0 10px',
                        borderRadius: 4,
                        background: 'var(--ob-orange)',
                        color: '#fff',
                        border: 'none',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      📋
                    </button>
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, color: 'var(--ob-text-muted)', margin: '0 0 4px' }}>X-OrangeBench-Inbound-Secret (header value)</p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      background: 'var(--ob-bg)',
                      border: '1px solid var(--ob-border)',
                      borderRadius: 8,
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
                      {revealedInbound.secret}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(revealedInbound.secret).then(() => {
                          showToast('密钥已复制');
                        }).catch(() => showToast('复制失败', false));
                      }}
                      style={{
                        height: 26,
                        padding: '0 10px',
                        borderRadius: 4,
                        background: 'var(--ob-orange)',
                        color: '#fff',
                        border: 'none',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      📋
                    </button>
                  </div>
                </div>
                {/* curl example */}
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, color: 'var(--ob-text-muted)', margin: '0 0 4px' }}>调用示例</p>
                  <pre
                    style={{
                      padding: '10px 12px',
                      background: 'var(--ob-bg)',
                      border: '1px solid var(--ob-border)',
                      borderRadius: 8,
                      fontFamily: 'var(--ob-font-mono)',
                      fontSize: 10,
                      color: 'var(--ob-text)',
                      margin: 0,
                      overflow: 'auto',
                      lineHeight: 1.5,
                    }}
                  >
{`curl -X POST '${revealedInbound.url}' \\
  -H 'Content-Type: application/json' \\
  -H 'X-OrangeBench-Inbound-Secret: <your-secret>' \\
  -d '{"input": "帮我整理本周运营数据成周报"}'`}
                  </pre>
                </div>
                <button
                  type="button"
                  onClick={() => setRevealedInbound(null)}
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

            {/* Add inbound button / form */}
            {!showInboundForm && (
              <button
                onClick={() => setShowInboundForm(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 38,
                  padding: '0 20px',
                  borderRadius: 8,
                  background: 'var(--ob-surface-hi)',
                  color: 'var(--ob-text)',
                  border: '1px solid var(--ob-border)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: 24,
                }}
              >
                <span style={{ fontSize: 14 }}>+</span>
                生成新入站 URL
              </button>
            )}

            {showInboundForm && (
              <div
                style={{
                  marginBottom: 28,
                  padding: 20,
                  background: 'var(--ob-surface)',
                  border: '1px solid var(--ob-border)',
                  borderRadius: 12,
                }}
              >
                <p style={{ fontSize: 12, color: 'var(--ob-text-muted)', margin: '0 0 12px' }}>
                  生成一个新的入站 URL + 密钥。你可以把这对凭证给任何调用方,让它们 POST 到 OB 来创建任务。
                </p>
                <input
                  value={inboundName}
                  onChange={e => setInboundName(e.target.value)}
                  placeholder="名称(给自己看,例如:Gmail 邮件触发器)"
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: '1px solid var(--ob-border)',
                    background: 'var(--ob-bg)',
                    color: 'var(--ob-text)',
                    fontSize: 14,
                    fontFamily: 'var(--ob-font-body)',
                    outline: 'none',
                    marginBottom: 14,
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--ob-orange)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--ob-border)')}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={handleAddInbound}
                    disabled={!inboundName.trim() || inboundSubmitting}
                    style={{
                      height: 38,
                      padding: '0 22px',
                      borderRadius: 8,
                      background: 'var(--ob-orange)',
                      color: '#fff',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: !inboundName.trim() || inboundSubmitting ? 0.5 : 1,
                    }}
                  >
                    {inboundSubmitting ? '生成中...' : '生成 URL + 密钥'}
                  </button>
                  <button
                    onClick={() => { setInboundName(''); setShowInboundForm(false); }}
                    style={{
                      height: 38,
                      padding: '0 18px',
                      borderRadius: 8,
                      background: 'transparent',
                      color: 'var(--ob-text-muted)',
                      border: '1px solid var(--ob-border)',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* Inbound list */}
            {inbounds && inbounds.length === 0 && !showInboundForm && (
              <div
                style={{
                  padding: '32px 24px',
                  textAlign: 'center',
                  background: 'var(--ob-surface)',
                  border: '1px dashed var(--ob-border)',
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📥</div>
                <p style={{ fontSize: 13, color: 'var(--ob-text-muted)', margin: 0 }}>
                  还没有入站 URL。生成一个,让外部系统能在 OB 里创建任务。
                </p>
              </div>
            )}

            {inbounds && inbounds.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {inbounds.map(ep => (
                  <div
                    key={ep.id}
                    style={{
                      padding: 16,
                      background: 'var(--ob-surface)',
                      border: '1px solid var(--ob-border)',
                      borderRadius: 12,
                      opacity: ep.active ? 1 : 0.6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 18 }}>📥</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ob-text)', flex: 1 }}>
                        {ep.name}
                      </span>
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
                      <span
                        style={{
                          fontFamily: 'var(--ob-font-mono)',
                          fontSize: 10,
                          color: 'var(--ob-text-muted)',
                        }}
                      >
                        ✓ {ep.callCount} · ✗ {ep.failureCount}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--ob-font-mono)',
                        fontSize: 10,
                        color: 'var(--ob-text-muted)',
                        wordBreak: 'break-all',
                        marginBottom: 8,
                      }}
                    >
                      {ep.url}
                    </div>
                    {ep.lastFiredAt && (
                      <div style={{ fontSize: 10, color: 'var(--ob-text-dim)', marginBottom: 8 }}>
                        最近触发:{new Date(ep.lastFiredAt).toLocaleString('zh-CN')}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--ob-border)' }}>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(ep.url).then(() => showToast('URL 已复制')).catch(() => showToast('复制失败', false));
                        }}
                        style={{
                          height: 28,
                          padding: '0 12px',
                          borderRadius: 6,
                          background: 'var(--ob-surface-hi)',
                          color: 'var(--ob-text)',
                          border: '1px solid var(--ob-border)',
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        📋 复制 URL
                      </button>
                      <button
                        onClick={() => handleToggleInboundActive(ep)}
                        style={{
                          height: 28,
                          padding: '0 12px',
                          borderRadius: 6,
                          background: 'var(--ob-surface-hi)',
                          color: 'var(--ob-text-muted)',
                          border: '1px solid var(--ob-border)',
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        {ep.active ? '⏸ 暂停' : '▶ 启用'}
                      </button>
                      <button
                        onClick={() => handleDeleteInbound(ep.id)}
                        style={{
                          height: 28,
                          padding: '0 12px',
                          borderRadius: 6,
                          background: 'transparent',
                          color: 'var(--ob-error, #E4483D)',
                          border: '1px solid var(--ob-border)',
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                          marginLeft: 'auto',
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Toast value={toast} />
    </div>
  );
}

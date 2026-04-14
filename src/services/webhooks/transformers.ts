import type { WebhookEvent, WebhookPayload } from './dispatcher';

// Per-platform message transformers.
//
// Each transformer takes the standard OB envelope and produces the
// platform-native request body. Used by the dispatcher to send
// beautifully-formatted messages to Chinese SMB chat platforms with
// zero extra config from the user — they just paste their group bot URL.
//
// Adding a new platform: add a function here + a case in dispatcher.ts.
// Schema kind column doesn't need migration (it's a free-form string).

export type WebhookKind = 'generic' | 'feishu' | 'dingtalk' | 'wecom';

// Human labels for each event — used in markdown bodies.
const EVENT_LABELS: Record<WebhookEvent, { emoji: string; title: string; verb: string }> = {
  task_assigned: { emoji: '[+]', title: '新任务分配', verb: '分配了新任务' },
  task_submitted: { emoji: '[>]', title: '待审核', verb: '提交了交付物' },
  task_revision: { emoji: '[~]', title: '需要修改', verb: '被退回修改' },
  task_completed: { emoji: '[v]', title: '任务完成', verb: '通过审核' },
  workspace_invite_accepted: { emoji: '[*]', title: '新成员加入', verb: '加入了工作区' },
  agent_task_completed: { emoji: '[A]', title: 'Agent 任务完成', verb: '执行完成' },
};

// Pull a sensible "title" string out of the data block. Each event puts
// the human-meaningful identifier in a slightly different field.
function extractTitle(data: Record<string, unknown>): string {
  return (
    (data.task_title as string) ||
    (data.title as string) ||
    (data.name as string) ||
    '(无标题)'
  );
}

function extractTaskUrl(data: Record<string, unknown>): string | null {
  return (data.task_url as string) || (data.url as string) || null;
}

// Build a short markdown body that all platforms can render.
// Each platform wraps this differently (color, font, layout) but
// the content is consistent.
function buildMarkdownBody(envelope: WebhookPayload): string {
  const event = envelope.event;
  const data = envelope.data;
  const label = EVENT_LABELS[event];
  const title = extractTitle(data);
  const url = extractTaskUrl(data);

  const lines: string[] = [];
  lines.push(`### ${label.emoji} ${label.title}`);
  lines.push('');
  lines.push(`> **${title}**`);

  // Event-specific footer line
  if (event === 'task_assigned' && data.assigned_by_name) {
    lines.push(`>`);
    lines.push(`> 由 ${data.assigned_by_name as string} 分配`);
  } else if (event === 'task_submitted' && data.submitted_by_name) {
    lines.push(`>`);
    lines.push(`> 提交人:${data.submitted_by_name as string}`);
  } else if (event === 'task_revision' && data.feedback) {
    const feedback = String(data.feedback).slice(0, 120);
    lines.push(`>`);
    lines.push(`> 修改意见:${feedback}`);
  }

  if (url) {
    lines.push('');
    lines.push(`[查看任务](${url})`);
  }

  return lines.join('\n');
}

// ── Generic — raw OB envelope ────────────────────────────────────────
// Zapier, webhook.site, n8n, custom HTTPS receivers.
// They get the full structured envelope so the user can route on any field.
export function transformGeneric(envelope: WebhookPayload): {
  body: string;
  contentType: string;
} {
  return {
    body: JSON.stringify(envelope),
    contentType: 'application/json',
  };
}

// ── 飞书 (Feishu / Lark) Group Bot ───────────────────────────────────
// API: https://open.feishu.cn/open-apis/bot/v2/hook/<uuid>
// Format reference: https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/bot-v2/use-custom-bots-in-a-group
//
// Use 'interactive' card format for richer rendering. Falls back to
// 'text' if the data has nothing structured to show.
export function transformFeishu(envelope: WebhookPayload): {
  body: string;
  contentType: string;
} {
  const event = envelope.event;
  const data = envelope.data;
  const label = EVENT_LABELS[event];
  const title = extractTitle(data);
  const url = extractTaskUrl(data);

  // Build interactive card
  const card: Record<string, unknown> = {
    config: { wide_screen_mode: true },
    header: {
      title: {
        tag: 'plain_text',
        content: `${label.emoji} ${label.title}`,
      },
      // 飞书 card colors:
      //   blue (assigned), turquoise (submitted), orange (revision),
      //   green (completed), grey (other)
      template:
        event === 'task_assigned' ? 'blue'
        : event === 'task_submitted' ? 'turquoise'
        : event === 'task_revision' ? 'orange'
        : event === 'task_completed' ? 'green'
        : 'grey',
    },
    elements: [] as unknown[],
  };
  const elements = card.elements as unknown[];

  // Title row
  elements.push({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `**${title}**`,
    },
  });

  // Optional context line
  let context: string | null = null;
  if (event === 'task_assigned' && data.assigned_by_name) {
    context = `由 ${data.assigned_by_name as string} 分配`;
  } else if (event === 'task_submitted' && data.submitted_by_name) {
    context = `提交人:${data.submitted_by_name as string}`;
  } else if (event === 'task_revision' && data.feedback) {
    const feedback = String(data.feedback).slice(0, 200);
    context = `**修改意见**\n${feedback}`;
  }
  if (context) {
    elements.push({
      tag: 'div',
      text: { tag: 'lark_md', content: context },
    });
  }

  // CTA button if we have a URL
  if (url) {
    elements.push({
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '查看任务' },
          type: 'primary',
          url,
        },
      ],
    });
  }

  return {
    body: JSON.stringify({
      msg_type: 'interactive',
      card,
    }),
    contentType: 'application/json',
  };
}

// ── 钉钉 (DingTalk) Group Bot ────────────────────────────────────────
// API: https://oapi.dingtalk.com/robot/send?access_token=<token>
// Format: https://open.dingtalk.com/document/group/custom-robot-access
// Note: 钉钉 markdown supports a limited subset (no nested blockquotes,
// no tables). We use simple markdown that renders correctly.
export function transformDingtalk(envelope: WebhookPayload): {
  body: string;
  contentType: string;
} {
  const event = envelope.event;
  const data = envelope.data;
  const label = EVENT_LABELS[event];
  const title = extractTitle(data);
  const url = extractTaskUrl(data);

  // 钉钉 markdown body
  const lines: string[] = [];
  lines.push(`### ${label.emoji} ${label.title}`);
  lines.push('');
  lines.push(`**${title}**`);

  if (event === 'task_assigned' && data.assigned_by_name) {
    lines.push('');
    lines.push(`由 ${data.assigned_by_name as string} 分配`);
  } else if (event === 'task_submitted' && data.submitted_by_name) {
    lines.push('');
    lines.push(`提交人:${data.submitted_by_name as string}`);
  } else if (event === 'task_revision' && data.feedback) {
    const feedback = String(data.feedback).slice(0, 200);
    lines.push('');
    lines.push(`> ${feedback}`);
  }

  if (url) {
    lines.push('');
    lines.push(`[👉 查看任务](${url})`);
  }

  return {
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        title: `${label.title} · ${title.slice(0, 30)}`,
        text: lines.join('\n'),
      },
    }),
    contentType: 'application/json',
  };
}

// ── 企业微信 (WeCom) Group Bot ───────────────────────────────────────
// API: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=<key>
// Format: https://developer.work.weixin.qq.com/document/path/91770
// 企微 markdown is very similar to 钉钉 but with slightly different
// rendering rules (e.g. > quotes are rendered as colored bars).
export function transformWeCom(envelope: WebhookPayload): {
  body: string;
  contentType: string;
} {
  return {
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        content: buildMarkdownBody(envelope),
      },
    }),
    contentType: 'application/json',
  };
}

// Lookup the right transformer for a given kind. Defaults to generic
// for unknown kinds (forward-compat).
export function getTransformer(kind: string) {
  switch (kind) {
    case 'feishu':
      return transformFeishu;
    case 'dingtalk':
      return transformDingtalk;
    case 'wecom':
      return transformWeCom;
    case 'generic':
    default:
      return transformGeneric;
  }
}

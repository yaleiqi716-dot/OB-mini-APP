import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

// Allowed event types — same vocabulary as the dispatcher.
// Keep this in sync with src/services/webhooks/dispatcher.ts WebhookEvent.
const ALLOWED_EVENTS = new Set([
  'task_assigned',
  'task_submitted',
  'task_revision',
  'task_completed',
  'workspace_invite_accepted',
  'agent_task_completed',
]);

// Allowed receiver kinds — must match transformers in src/services/webhooks/transformers.ts
const ALLOWED_KINDS = new Set(['generic', 'feishu', 'dingtalk', 'wecom']);

// GET /api/webhooks — list current user's webhook endpoints
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      endpoints.map(e => ({
        id: e.id,
        kind: e.kind,
        name: e.name,
        // Mask all but the last 12 chars of the URL path so the list view
        // doesn't leak full Zapier hooks in screenshots / logs.
        url: maskUrl(e.url),
        events: e.events ? safeParseArray(e.events) : [],
        active: e.active,
        failureCount: e.failureCount,
        lastFiredAt: e.lastFiredAt?.toISOString() || null,
        lastError: e.lastError,
        createdAt: e.createdAt.toISOString(),
        // Boolean indicator only — never expose the actual secret in list.
        // Old rows from chunk 1/2 (pre-HMAC) report false here.
        hasSecret: !!e.secret,
      })),
    );
  } catch (err) {
    console.error('[WEBHOOK_LIST_ERROR]', err);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// POST /api/webhooks — create a new endpoint
// Body: { name, url, events?: string[] }
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const body = await req.json();
    const { name, url, events, kind } = body as {
      name?: string;
      url?: string;
      events?: unknown;
      kind?: string;
    };

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '请填写名称' }, { status: 400 });
    }
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: '请填写 webhook URL' }, { status: 400 });
    }
    // Only allow https for safety. http localhost is fine in dev.
    if (
      !url.startsWith('https://') &&
      !(process.env.NODE_ENV !== 'production' && url.startsWith('http://'))
    ) {
      return NextResponse.json({ error: 'URL 必须使用 https://' }, { status: 400 });
    }

    // Validate kind. Default to generic for backward compat with existing
    // clients that don't send the field.
    const normalizedKind = typeof kind === 'string' && ALLOWED_KINDS.has(kind) ? kind : 'generic';

    // Sanitize events array
    let eventsJson: string | null = null;
    if (Array.isArray(events) && events.length > 0) {
      const clean = events
        .filter((e): e is string => typeof e === 'string')
        .filter(e => ALLOWED_EVENTS.has(e));
      if (clean.length === 0) {
        return NextResponse.json({ error: '事件类型无效' }, { status: 400 });
      }
      eventsJson = JSON.stringify(clean);
    }

    // Generate a 32-byte HMAC signing secret. Receivers verify outbound
    // payloads via X-OrangeBench-Signature header. Only generic endpoints
    // need a secret (Chinese platform bots don't read custom headers), but
    // we generate one for all kinds so future cross-platform features work.
    const secret = randomBytes(32).toString('hex');

    const created = await prisma.webhookEndpoint.create({
      data: {
        userId,
        kind: normalizedKind,
        name: name.trim().slice(0, 100),
        url: url.trim(),
        events: eventsJson,
        secret,
      },
    });

    // Return the FULL secret here exactly once. Subsequent GET/list
    // responses must NOT include it (only mask form). This is the same
    // pattern as GitHub PAT, AWS access key, etc — the user copies it
    // immediately and stores it on their receiver side; we only show it once.
    return NextResponse.json({
      id: created.id,
      kind: created.kind,
      name: created.name,
      url: maskUrl(created.url),
      events: eventsJson ? JSON.parse(eventsJson) : [],
      active: created.active,
      createdAt: created.createdAt.toISOString(),
      // ONCE-ONLY full secret value — UI must surface a "copy now" prompt
      // on first display because we won't return it again.
      secret: created.secret,
    });
  } catch (err) {
    console.error('[WEBHOOK_CREATE_ERROR]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}

// Mask a webhook URL — keep host visible, redact path tail.
// Used in list/create responses so the dashboard doesn't leak full URLs
// to screenshots/clients/dev tools.
function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname;
    if (path.length <= 12) return `${u.origin}${path}`;
    return `${u.origin}${path.slice(0, 6)}...${path.slice(-6)}`;
  } catch {
    return url.length > 30 ? url.slice(0, 12) + '...' + url.slice(-6) : url;
  }
}

function safeParseArray(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

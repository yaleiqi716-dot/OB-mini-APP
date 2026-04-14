import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

const ALLOWED_ACTIONS = new Set(['create_agent_task']);

// GET /api/webhooks/inbound — list current user's inbound endpoints
//
// Returns the public URL the user can hand to Zapier and friends, plus
// usage stats. The actual secret value is NEVER returned by list (only
// once on create). UI shows a "hasSecret: true" badge so the user knows
// the row is signed.
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const endpoints = await prisma.webhookInbound.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return NextResponse.json(
      endpoints.map(e => ({
        id: e.id,
        name: e.name,
        action: e.action,
        active: e.active,
        // Build the public URL the user can hand to Zapier — no auth in
        // the URL itself; auth is via the X-OrangeBench-Inbound-Secret header.
        url: `${baseUrl}/api/webhooks/inbound/${e.id}`,
        callCount: e.callCount,
        failureCount: e.failureCount,
        lastFiredAt: e.lastFiredAt?.toISOString() || null,
        createdAt: e.createdAt.toISOString(),
        // Indicator only — actual secret never returned by list.
        hasSecret: !!e.secret,
      })),
    );
  } catch (err) {
    console.error('[INBOUND_LIST_ERROR]', err);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// POST /api/webhooks/inbound — create a new inbound endpoint.
// Body: { name, action? }
//
// Returns the FULL secret ONCE so the user can configure their caller
// (Zapier filter, n8n header, custom curl) with it. After this, the
// secret value is never returned again. Same pattern as outbound.
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { name, action } = body as { name?: string; action?: string };

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '请填写名称' }, { status: 400 });
    }

    const normalizedAction =
      typeof action === 'string' && ALLOWED_ACTIONS.has(action) ? action : 'create_agent_task';

    // Generate the auth secret. Same length / format as outbound (64-hex).
    const secret = randomBytes(32).toString('hex');

    const created = await prisma.webhookInbound.create({
      data: {
        userId,
        name: name.trim().slice(0, 100),
        action: normalizedAction,
        secret,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return NextResponse.json({
      id: created.id,
      name: created.name,
      action: created.action,
      active: created.active,
      url: `${baseUrl}/api/webhooks/inbound/${created.id}`,
      callCount: 0,
      failureCount: 0,
      lastFiredAt: null,
      createdAt: created.createdAt.toISOString(),
      hasSecret: true,
      // ONCE-ONLY full secret — UI must surface a "copy now" prompt.
      secret: created.secret,
    });
  } catch (err) {
    console.error('[INBOUND_CREATE_ERROR]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}

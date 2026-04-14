import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

// DELETE /api/webhooks/[id] — remove a webhook endpoint.
// Owner-only — verifies the row's userId matches the auth context before
// deleting. WebhookLogs are NOT cascade-deleted (kept for audit/debug);
// they become orphans but the schema's findMany on endpointId won't return
// them anyway since the endpoint is gone.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: params.id },
    });
    if (!endpoint) {
      return NextResponse.json({ error: '不存在' }, { status: 404 });
    }
    if (endpoint.userId !== userId) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    await prisma.webhookEndpoint.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[WEBHOOK_DELETE_ERROR]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}

// PATCH /api/webhooks/[id] — toggle active state, re-enable after auto-disable
// Body: { active?: boolean, name?: string, events?: string[] }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: params.id },
    });
    if (!endpoint) return NextResponse.json({ error: '不存在' }, { status: 404 });
    if (endpoint.userId !== userId) return NextResponse.json({ error: '无权限' }, { status: 403 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.active === 'boolean') {
      data.active = body.active;
      // Re-enabling resets the failure count so the user gets a clean retry budget.
      if (body.active === true && endpoint.failureCount > 0) {
        data.failureCount = 0;
        data.lastError = null;
      }
    }
    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim().slice(0, 100);
    }
    if (Array.isArray(body.events)) {
      const ALLOWED = new Set([
        'task_assigned', 'task_submitted', 'task_revision', 'task_completed',
        'workspace_invite_accepted', 'agent_task_completed',
      ]);
      const clean = body.events
        .filter((e: unknown): e is string => typeof e === 'string')
        .filter((e: string) => ALLOWED.has(e));
      data.events = clean.length > 0 ? JSON.stringify(clean) : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      active: updated.active,
      events: updated.events ? safeParse(updated.events) : [],
    });
  } catch (err) {
    console.error('[WEBHOOK_UPDATE_ERROR]', err);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

// /api/webhooks/inbound/manage/[id]
//
// Lives under /manage/[id] (NOT /api/webhooks/inbound/[id]) because the
// public inbound POST handler at /api/webhooks/inbound/[id] is intentionally
// unauth (HMAC secret only) and shouldn't share a route segment with
// auth-gated DELETE/PATCH operations.
//
// Owner-only — verifies row.userId matches auth ctx.

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const inbound = await prisma.webhookInbound.findUnique({ where: { id: params.id } });
    if (!inbound) return NextResponse.json({ error: '不存在' }, { status: 404 });
    if (inbound.userId !== userId) return NextResponse.json({ error: '无权限' }, { status: 403 });

    await prisma.webhookInbound.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[INBOUND_DELETE_ERROR]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const inbound = await prisma.webhookInbound.findUnique({ where: { id: params.id } });
    if (!inbound) return NextResponse.json({ error: '不存在' }, { status: 404 });
    if (inbound.userId !== userId) return NextResponse.json({ error: '无权限' }, { status: 403 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.active === 'boolean') {
      data.active = body.active;
      // Re-enabling resets the failure count
      if (body.active === true && inbound.failureCount > 0) {
        data.failureCount = 0;
      }
    }
    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim().slice(0, 100);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    }

    const updated = await prisma.webhookInbound.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      active: updated.active,
    });
  } catch (err) {
    console.error('[INBOUND_UPDATE_ERROR]', err);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

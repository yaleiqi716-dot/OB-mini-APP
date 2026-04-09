import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

async function ownerCheck(req: NextRequest, id: string) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return { err: NextResponse.json({ error: '未登录' }, { status: 401 }), userId: null };
  }
  const row = await prisma.mcpServer.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!row) {
    return { err: NextResponse.json({ error: '不存在' }, { status: 404 }), userId: null };
  }
  if (row.userId !== userId) {
    return { err: NextResponse.json({ error: '无权限' }, { status: 403 }), userId: null };
  }
  return { err: null, userId };
}

// DELETE /api/mcp/[id] — uninstall (also cascades McpUsageLog via manual cleanup)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { err } = await ownerCheck(req, params.id);
    if (err) return err;

    // Audit log rows are retained (userId-scoped) so the user can still
    // see "I called tool X on deleted server Y at time Z". The FK on
    // McpUsageLog doesn't cascade — intentional.
    await prisma.mcpServer.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[MCP_DELETE_ERROR]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}

// PATCH /api/mcp/[id] — toggle enabled or rename
//   Body: { enabled?: boolean, name?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { err } = await ownerCheck(req, params.id);
    if (err) return err;

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.enabled === 'boolean') data.enabled = body.enabled;
    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim().slice(0, 100);
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    }

    const updated = await prisma.mcpServer.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, enabled: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[MCP_PATCH_ERROR]', err);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

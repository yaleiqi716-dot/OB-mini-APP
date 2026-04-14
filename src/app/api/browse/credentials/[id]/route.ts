import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { deleteCredential } from '@/services/tools/browse-vault';

export const runtime = 'nodejs';

// DELETE /api/browse/credentials/[id]
// Owner-only — confirms row.userId before delete.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const row = await prisma.browseCredential.findUnique({
      where: { id: params.id },
      select: { userId: true },
    });
    if (!row) return NextResponse.json({ error: '不存在' }, { status: 404 });
    if (row.userId !== userId) return NextResponse.json({ error: '无权限' }, { status: 403 });

    await deleteCredential(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[BROWSE_CRED_DELETE_ERROR]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}

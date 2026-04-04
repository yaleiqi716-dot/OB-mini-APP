import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, isErrorResponse } from '@/lib/workspace-auth';

// DELETE — Remove a member (owner only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await withAuth(req);
    if (isErrorResponse(ctx)) return ctx;

    const member = await prisma.workspaceMember.findUnique({
      where: { id: params.id },
      include: { workspace: true },
    });
    if (!member) return NextResponse.json({ error: '成员不存在' }, { status: 404 });

    // Only workspace owner can remove members
    if (member.workspace.ownerId !== ctx.userId) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    // Cannot remove the owner
    if (member.role === 'owner') {
      return NextResponse.json({ error: '无法移除工作区所有者' }, { status: 400 });
    }

    await prisma.workspaceMember.update({
      where: { id: params.id },
      data: { status: 'removed' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WORKSPACE_MEMBER_REMOVE_ERROR]', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}

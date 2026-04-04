import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

// GET — Validate invite token (public — no auth required)
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const invite = await prisma.workspaceInvite.findUnique({
      where: { token: params.token },
      include: { workspace: { select: { name: true } } },
    });

    if (!invite) {
      return NextResponse.json({ valid: false, reason: 'not_found' });
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ valid: false, reason: invite.status });
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ valid: false, reason: 'expired' });
    }

    return NextResponse.json({
      valid: true,
      workspaceName: invite.workspace.name,
      email: invite.email,
      role: invite.role,
    });
  } catch (error) {
    console.error('[INVITE_VALIDATE_ERROR]', error);
    return NextResponse.json({ valid: false, reason: 'error' });
  }
}

// DELETE — Revoke invite by token (owner only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const invite = await prisma.workspaceInvite.findUnique({
      where: { token: params.token },
      include: { workspace: true },
    });

    if (!invite) return NextResponse.json({ error: '邀请不存在' }, { status: 404 });
    if (invite.workspace.ownerId !== userId) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }
    if (invite.status !== 'pending') {
      return NextResponse.json({ error: '只能撤销待接受的邀请' }, { status: 400 });
    }

    await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { status: 'revoked' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[INVITE_REVOKE_ERROR]', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}

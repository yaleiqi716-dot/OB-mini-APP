import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

// POST — Accept invite (must be logged in)
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const invite = await prisma.workspaceInvite.findUnique({
      where: { token: params.token },
    });

    if (!invite) {
      return NextResponse.json({ error: '邀请不存在' }, { status: 404 });
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ error: '邀请已被使用或已撤销' }, { status: 400 });
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: '邀请已过期，请联系管理员重新邀请' }, { status: 400 });
    }

    // Check if already a member
    const existingMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: invite.workspaceId, userId, status: 'active' },
    });
    if (existingMember) {
      // Already a member — mark invite as accepted and return success
      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted', acceptedUserId: userId },
      });
      return NextResponse.json({ success: true, workspaceId: invite.workspaceId, alreadyMember: true });
    }

    // Atomic: accept invite + create membership
    await prisma.$transaction([
      prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted', acceptedUserId: userId },
      }),
      prisma.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId,
          role: invite.role,
          status: 'active',
          joinedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({ success: true, workspaceId: invite.workspaceId });
  } catch (error) {
    console.error('[INVITE_ACCEPT_ERROR]', error);
    return NextResponse.json({ error: '加入失败' }, { status: 500 });
  }
}

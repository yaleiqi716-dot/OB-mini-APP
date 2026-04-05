import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, isErrorResponse } from '@/lib/workspace-auth';

// POST — Accept invite (must be logged in)
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const ctx = await withAuth(req);
    if (isErrorResponse(ctx)) return ctx;

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

    // Atomic: check membership + accept invite + create membership — all inside transaction
    const result = await prisma.$transaction(async (tx) => {
      // Check if already a member INSIDE transaction to prevent race condition
      const existingMember = await tx.workspaceMember.findFirst({
        where: { workspaceId: invite.workspaceId, userId: ctx.userId, status: 'active' },
      });

      // Mark invite as accepted regardless
      await tx.workspaceInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted', acceptedUserId: ctx.userId },
      });

      if (existingMember) {
        return { alreadyMember: true };
      }

      await tx.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId: ctx.userId,
          role: invite.role,
          status: 'active',
          joinedAt: new Date(),
        },
      });

      return { alreadyMember: false };
    });

    return NextResponse.json({ success: true, workspaceId: invite.workspaceId, alreadyMember: result.alreadyMember });
  } catch (error) {
    console.error('[INVITE_ACCEPT_ERROR]', error);
    return NextResponse.json({ error: '加入失败' }, { status: 500 });
  }
}

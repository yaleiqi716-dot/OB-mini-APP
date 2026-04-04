import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withWorkspaceMember, isErrorResponse } from '@/lib/workspace-auth';

// GET — List workspace members
export async function GET(req: NextRequest) {
  try {
    const ctx = await withWorkspaceMember(req);
    if (isErrorResponse(ctx)) return ctx;

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: ctx.workspaceId, status: 'active' },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return NextResponse.json(members.map(m => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt?.toISOString(),
      email: m.user.email,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
    })));
  } catch (error) {
    console.error('[WORKSPACE_MEMBERS_ERROR]', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
